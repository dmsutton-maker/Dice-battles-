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
  created_at   timestamptz not null default now()
);

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
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ideas_status_idx on public.ideas (status);
create index if not exists ideas_phase_idx on public.ideas (phase_id);

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
