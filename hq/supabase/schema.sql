-- Dice Battles HQ — database schema.
--
-- Run this once against a NEW, PERSONAL Supabase project (never an
-- employer-linked one). Paste it into the SQL editor and press run; it is
-- written to be safe to run again.
--
-- The shape of the thing: anyone on the team can put an IDEA in. David
-- decides whether it is approved. Approved ideas get sorted into PHASES,
-- which is what makes the timeline. Claude reads the approved list and
-- works down it, marking things in progress and then shipped with the
-- version number they went out in — so the board, the CHANGELOG and the
-- game always tell the same story.

-- ---------------------------------------------------------------------
-- Who is allowed in
-- ---------------------------------------------------------------------

-- An email has to be listed here BEFORE that person can sign in. This is
-- a private family workspace, not a public sign-up: without the gate,
-- anyone who found the URL could request a login link and get one.
create table if not exists public.allowed_emails (
  email       text primary key,
  display_name text not null,
  role        text not null default 'contributor'
              check (role in ('owner', 'contributor')),
  invited_at  timestamptz not null default now()
);

comment on table public.allowed_emails is
  'The guest list. Sign-in is refused for any address not on it.';

-- One row per person who has actually signed in, linked to their login.
create table if not exists public.members (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null unique,
  display_name text not null,
  role         text not null default 'contributor'
               check (role in ('owner', 'contributor')),
  -- True while someone is still using a password that was handed to
  -- them. A password another person knows is not really a password, so
  -- the HQ will not open until they have set their own.
  must_change_password boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.members
  add column if not exists must_change_password boolean not null default false;

-- Convenience: is the person making this request the owner?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Is the person making this request a member at all?
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;

-- When someone signs in for the first time, promote their guest-list
-- entry into a member row. An address that is not on the list is refused
-- here, which is what stops a stranger with the URL from getting in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.allowed_emails%rowtype;
begin
  select * into invite
  from public.allowed_emails
  where lower(email) = lower(new.email);

  if not found then
    raise exception 'This email has not been invited to Dice Battles HQ.';
  end if;

  insert into public.members (id, email, display_name, role)
  values (new.id, new.email, invite.display_name, invite.role)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Phases — the timeline
-- ---------------------------------------------------------------------

create table if not exists public.phases (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  summary    text not null default '',
  status     text not null default 'planned'
             check (status in ('planned', 'active', 'done')),
  starts_on  date,
  ends_on    date,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.phases is
  'Chunks of time work is grouped into. Ordered by position, not by date, '
  'so a phase can slip without the board reshuffling itself.';

-- ---------------------------------------------------------------------
-- Ideas — the actual work
-- ---------------------------------------------------------------------

create table if not exists public.ideas (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(trim(title)) > 0),
  detail        text not null default '',
  category      text not null default 'game'
                check (category in
                  ('game', 'revenue', 'art', 'sound', 'website', 'other')),
  -- A BUG is something already broken, and fixing it needs nobody's
  -- permission — waiting on an approval to repair what is meant to work
  -- already only leaves it broken longer. A FEATURE changes what the
  -- game is, so it waits for David.
  kind          text not null default 'feature'
                check (kind in ('bug', 'feature')),
  -- pending  : waiting on David
  -- approved : Claude may pick this up
  -- building : Claude is on it now
  -- shipped  : live in the game, with the version it went out in
  -- parked   : a good idea, just not now
  -- declined : decided against
  status        text not null default 'pending'
                check (status in
                  ('pending', 'approved', 'building', 'shipped',
                   'parked', 'declined')),
  -- 1 is most urgent; used to order the approved queue.
  priority      integer not null default 3 check (priority between 1 and 5),
  phase_id      uuid references public.phases (id) on delete set null,
  submitted_by  uuid references public.members (id) on delete set null,
  decided_by    uuid references public.members (id) on delete set null,
  decided_at    timestamptz,
  decision_note text not null default '',
  shipped_version text not null default '',
  -- WHEN to do it, as opposed to whether. An idea can be approved months
  -- early and still sit untouched until its date: "holiday themes" is
  -- approved in August and started in November. Null means "any time".
  scheduled_for date,
  -- When it has to be finished. Christmas content shipped on 26 December
  -- is worthless, so the deadline matters separately from the start.
  deadline      date,
  -- Seasonal work comes round again every year rather than being done
  -- once and closed.
  repeats_yearly boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Older databases predate the scheduling columns.
alter table public.ideas add column if not exists kind text not null
  default 'feature' check (kind in ('bug', 'feature'));
alter table public.ideas add column if not exists scheduled_for date;
alter table public.ideas add column if not exists deadline date;
alter table public.ideas
  add column if not exists repeats_yearly boolean not null default false;

create index if not exists ideas_scheduled_idx on public.ideas (scheduled_for);

create index if not exists ideas_status_idx on public.ideas (status);
create index if not exists ideas_phase_idx on public.ideas (phase_id);
-- Used by /api/bug-report's flood check: bugs reported in the last minute.
create index if not exists ideas_kind_created_idx on public.ideas (kind, created_at);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  member_id  uuid references public.members (id) on delete set null,
  body       text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists comments_idea_idx on public.comments (idea_id);

-- Every decision, kept. The same reason the CHANGELOG records who asked
-- for what: so a change can always be traced back to a person.
create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid references public.ideas (id) on delete cascade,
  actor      text not null,
  action     text not null,
  detail     text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists activity_created_idx on public.activity (created_at desc);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ideas_touch_updated_at on public.ideas;
create trigger ideas_touch_updated_at
  before update on public.ideas
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Messages — what players send through the contact form
--
-- The public pages carry no email address on purpose: an address printed
-- on a privacy policy gets harvested within days, and it would be a
-- personal one. Players write through a form instead, it lands here, and
-- the family reads it in the HQ.
-- ---------------------------------------------------------------------

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  email      text not null default '',
  subject    text not null default '',
  body       text not null,
  device     text not null default '',
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_created_idx
  on public.messages (created_at desc);

alter table public.messages enable row level security;

-- Nobody reaches this table with a browser key. Members read it once
-- signed in; the form itself writes through the server, which uses the
-- service role. There is deliberately no public insert policy — an open
-- insert policy on a public table is an open invitation to fill it.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (public.is_member());

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update using (public.is_member()) with check (public.is_member());

-- ---------------------------------------------------------------------
-- Proposals — the things Claude puts up for the family to vote on
--
-- Different from ideas on purpose. An idea is something one person WANTS
-- and David says yes or no to. A proposal is a question with several
-- answers where the right one is a matter of taste, so everybody gets a
-- say: which app icon, which name, which colour. Claude raises these;
-- the family votes; David closes it by picking one.
-- ---------------------------------------------------------------------

create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  question     text not null default '',
  detail       text not null default '',
  raised_by    text not null default 'Claude',
  -- Set when a person raises the question rather than Claude, so they can
  -- keep editing their own options while it is still open.
  raised_by_id uuid references public.members (id) on delete set null,
  status       text not null default 'open'
               check (status in ('open', 'decided')),
  chosen_option uuid,
  decided_note text not null default '',
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table if not exists public.proposal_options (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  label       text not null,
  detail      text not null default '',
  -- A picture where there is one (an app icon), otherwise just words.
  image_url   text,
  position    integer not null default 0
);

create index if not exists proposal_options_proposal_idx
  on public.proposal_options (proposal_id);

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  option_id   uuid not null references public.proposal_options (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- One vote each. Changing your mind replaces your vote rather than
  -- adding a second one.
  unique (proposal_id, member_id)
);

alter table public.proposals        enable row level security;
alter table public.proposal_options enable row level security;
alter table public.votes            enable row level security;

drop policy if exists proposals_read on public.proposals;
create policy proposals_read on public.proposals
  for select using (public.is_member());

-- Anyone in the family can PUT a question up. Settling it stays David's,
-- same as approving an idea: asking is open, deciding is not.
alter table public.proposals add column if not exists raised_by_id uuid
  references public.members (id) on delete set null;

drop policy if exists proposals_write on public.proposals;
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals
  for insert with check (public.is_member() and raised_by_id = auth.uid());

drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals
  for update using (public.is_owner()) with check (public.is_owner());

drop policy if exists proposals_delete on public.proposals;
create policy proposals_delete on public.proposals
  for delete using (
    public.is_owner()
    -- Or your own question, as long as nobody has voted on it yet.
    or (raised_by_id = auth.uid()
        and not exists (select 1 from public.votes v where v.proposal_id = id))
  );

drop policy if exists proposal_options_read on public.proposal_options;
create policy proposal_options_read on public.proposal_options
  for select using (public.is_member());

drop policy if exists proposal_options_write on public.proposal_options;
drop policy if exists proposal_options_insert on public.proposal_options;
-- Options may only be added to a question you raised, and only while it
-- is still open — otherwise a new choice could appear after voting began.
create policy proposal_options_insert on public.proposal_options
  for insert with check (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_id
        and p.status = 'open'
        and (p.raised_by_id = auth.uid() or public.is_owner())
    )
  );

drop policy if exists proposal_options_modify on public.proposal_options;
create policy proposal_options_modify on public.proposal_options
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists votes_read on public.votes;
create policy votes_read on public.votes
  for select using (public.is_member());

-- You may cast, change and withdraw your OWN vote, and nobody else's.
drop policy if exists votes_own on public.votes;
create policy votes_own on public.votes
  for all using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ---------------------------------------------------------------------
-- Row level security
--
-- Everything is closed by default. Members read everything; members add
-- ideas and comments; only the owner decides an idea's fate or moves the
-- timeline. The kids can propose anything and argue for it — they just
-- cannot approve their own ideas.
-- ---------------------------------------------------------------------

alter table public.allowed_emails enable row level security;
alter table public.members        enable row level security;
alter table public.phases         enable row level security;
alter table public.ideas          enable row level security;
alter table public.comments       enable row level security;
alter table public.activity       enable row level security;

drop policy if exists members_read on public.members;
create policy members_read on public.members
  for select using (public.is_member());

drop policy if exists allowed_emails_owner on public.allowed_emails;
create policy allowed_emails_owner on public.allowed_emails
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists phases_read on public.phases;
create policy phases_read on public.phases
  for select using (public.is_member());

drop policy if exists phases_write on public.phases;
create policy phases_write on public.phases
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists ideas_read on public.ideas;
create policy ideas_read on public.ideas
  for select using (public.is_member());

drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas
  for insert with check (public.is_member() and submitted_by = auth.uid());

-- A contributor may keep editing their own idea while it is still
-- pending; once it has been decided, only the owner touches it.
drop policy if exists ideas_update_own on public.ideas;
create policy ideas_update_own on public.ideas
  for update using (
    public.is_owner()
    or (submitted_by = auth.uid() and status = 'pending')
  ) with check (
    public.is_owner()
    or (submitted_by = auth.uid() and status = 'pending')
  );

drop policy if exists ideas_delete_owner on public.ideas;
create policy ideas_delete_owner on public.ideas
  for delete using (public.is_owner());

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments
  for select using (public.is_member());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert with check (public.is_member() and member_id = auth.uid());

drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity
  for select using (public.is_member());

drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity
  for insert with check (public.is_member());

-- ---------------------------------------------------------------------
-- Seed
--
-- David is the owner. Add the kids here (or from the People page once
-- signed in) — one row each, then they can request a login link.
-- ---------------------------------------------------------------------

insert into public.allowed_emails (email, display_name, role)
values ('dmsutton@gmail.com', 'David', 'owner')
on conflict (email) do nothing;

-- The phases the project is actually in, so the timeline is not empty on
-- day one. Edit freely once you are in.
insert into public.phases (name, summary, status, position)
select * from (values
  ('Phase 1 — TestFlight',
   'The game on real phones, family testing it, bugs found and fixed.',
   'active', 1),
  ('Phase 2 — App Store launch',
   'Screenshots, description, review, and the first public release.',
   'planned', 2),
  ('Phase 3 — Making money',
   'Ads with a paid remove-ads option, the coin store, season passes.',
   'planned', 3),
  ('Phase 4 — Playing together',
   'Online multiplayer, Game Center world rankings, iPad.',
   'planned', 4)
) as seed(name, summary, status, position)
where not exists (select 1 from public.phases);

-- The first thing to vote on: which app icon the game ships with. The
-- four pictures are real files in this site's own /icons folder, so they
-- show up the moment the site is deployed.
with new_proposal as (
  insert into public.proposals (title, question, detail, raised_by)
  select
    'Which app icon should we ship?',
    'This is the picture on the home screen — for most people it is the '
    'first thing they ever see of the game, at about the size of a '
    'fingernail. Pick the one you would tap.',
    'Look at the small versions as well as the big ones. An icon that is '
    'beautiful at full size and mush at thumbnail size is the wrong icon. '
    'Nothing here is final — whichever wins can still be recoloured or '
    'adjusted.',
    'Claude'
  where not exists (select 1 from public.proposals)
  returning id
)
insert into public.proposal_options (proposal_id, label, detail, image_url, position)
select
  new_proposal.id,
  option.label,
  option.detail,
  option.image_url,
  option.position
from new_proposal
cross join (values
  ('Perfect Match',
   'Two dice that have both landed on red — the exact moment you are '
   'playing for. The six game colours run along the bottom.',
   '/icons/a-perfect-match.svg', 1),
  ('Colour Cube',
   'One big die showing three faces in three different colours. The '
   'boldest of the four and the easiest to recognise when it is tiny.',
   '/icons/b-colour-cube.svg', 2),
  ('Crossed Swords',
   'Swords behind a die, matching the ⚔️ DICE BATTLES ⚔️ title on the '
   'home screen. Says "battle" loudest; the busiest of the four.',
   '/icons/c-crossed-swords.svg', 3),
  ('Colour Rush',
   'A die hurled across the frame trailing all six colours behind it. '
   'Leans into the new name and the speed of a round.',
   '/icons/d-colour-rush.svg', 4)
) as option(label, detail, image_url, position);
