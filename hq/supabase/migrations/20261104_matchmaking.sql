-- Online matchmaking, 4 Nov 2026.
--
-- Marc: "add the online matchmaking where you now verse real players
-- instead of bots. it should search for a player for 15 seconds and it
-- should say 'searching for opponent' or something, and if it can't find
-- a real person to verse after 15 seconds then it loads you against one
-- of the bots".
--
-- A searching phone asks /api/match about once a second
-- (hq/src/app/api/match/route.ts). Each ask stamps the player's row in
-- `match_queue` and looks for somebody else whose row is fresh
-- (hq/src/lib/matchQueue.ts). Two who fit are paired by claim_match()
-- below, which writes ONE ordinary battle row for both, born 'waiting'
-- like an accepted friend challenge and marked kind = 'match'. From there
-- the two phones play it through /api/battles/live, the friends' protocol.
--
-- The website does NOT depend on this file being applied: until it is,
-- /api/match answers {"state":"off"} and the game plays a bot at once,
-- which is what it did before. Old site code ignores everything here.
--
-- Safe to run more than once. Contains no DROP. NOT applied by the agent
-- that wrote it; somebody with database access applies it.

-- What kind of battle a row is. 'friend' is every battle so far (a
-- challenge between friends, worth nothing); 'match' is a stranger from
-- matchmaking. /api/battles GET never hands a 'match' row to the friends
-- poll, and /api/battles/live treats a match's waiting-room leave and
-- win claim more strictly.
alter table public.battles
  add column if not exists kind text not null default 'friend';

-- NOT VALID, so no existing row is re-checked: every one of them got the
-- default above. New and updated rows are checked.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_kind_is_known'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_kind_is_known
      check (kind in ('friend', 'match'))
      not valid;
  end if;
end $$;

-- One row per player who is, or was lately, looking for a game. The row
-- is re-stamped (`seen_at`) on every ask; one not stamped for four
-- seconds is not paired with, and one not stamped for ten minutes is
-- deleted by the next search. `joined_at` is when this search began, so
-- the trophy band can widen with the wait.
--
-- state: 'searching' (looking), 'matched' (battle_id says where to go),
-- 'withdrawn' (gave up, or the fifteen seconds ran out).
create table if not exists public.match_queue (
  player_id   text primary key references public.player_profiles (player_id) on delete cascade,
  mode        text not null,
  difficulty  text not null,
  trophies    integer not null default 0,
  state       text not null default 'searching',
  joined_at   timestamptz not null,
  seen_at     timestamptz not null,
  battle_id   uuid,
  opponent_id text
);

-- The search: who is searching in this mode and difficulty, freshest first.
create index if not exists match_queue_search_idx
  on public.match_queue (state, mode, difficulty, seen_at desc);

-- No policies: every read and write goes through the HQ API with the
-- service key, which checks the device secret first — the same
-- arrangement battles and player_profiles have.
alter table public.match_queue enable row level security;

-- Pair two searching players and write their battle, in ONE transaction.
--
-- Two phones can each find the other in the same instant, and a third can
-- pick one of them too. Both queue rows are locked first, always in the
-- same order so two claims cannot wait on each other; then both must
-- still be searching in this mode and difficulty, or the whole thing is
-- undone by the exception and the route reads that as "taken, ask
-- again". Only then is the battle written.
--
-- `p_born` comes from the ROUTE, the web server's clock, not now():
-- `started_at`, `a_seen` and `b_seen` are written as that one instant,
-- and the live route reads "their seen is later than the start" as "they
-- have arrived" using the same server's clock for every beat.
create or replace function public.claim_match(
  p_battle     uuid,
  p_a          text,
  p_b          text,
  p_mode       text,
  p_difficulty text,
  p_born       timestamptz
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  paired integer;
begin
  if p_a = p_b then
    raise exception 'claim_match: a player cannot be paired with themselves';
  end if;

  perform 1 from public.match_queue
    where player_id in (p_a, p_b)
    order by player_id
    for update;

  update public.match_queue
    set state = 'matched',
        battle_id = p_battle,
        opponent_id = case when player_id = p_a then p_b else p_a end
    where player_id in (p_a, p_b)
      and state = 'searching'
      and mode = p_mode
      and difficulty = p_difficulty;
  get diagnostics paired = row_count;

  if paired <> 2 then
    raise exception 'claim_match: one of the two is no longer searching';
  end if;

  insert into public.battles
    (id, a_id, b_id, mode, difficulty, state, started_at, a_seen, b_seen, kind)
  values
    (p_battle, p_a, p_b, p_mode, p_difficulty, 'waiting', p_born, p_born, p_born, 'match');

  return true;
end;
$$;

-- Callable only with the service role, which is what the route uses:
-- anon must not be able to put two strangers in a battle.
revoke all on function public.claim_match(uuid, text, text, text, text, timestamptz) from public;
revoke all on function public.claim_match(uuid, text, text, text, text, timestamptz) from anon, authenticated;
grant execute on function public.claim_match(uuid, text, text, text, text, timestamptz) to service_role;
