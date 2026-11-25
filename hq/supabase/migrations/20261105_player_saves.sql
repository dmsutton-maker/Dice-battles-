-- The player's progress backup, 5 Nov 2026.
--
-- Marc: "When I delete the game and redownload it, it completely resets
-- my account, friends, friend code, trophies, coins, and everything."
--
-- One row per player: the snapshot the game collects of its own saved
-- progress (src/game/cloudSave.ts: trophies and the record, the wallet,
-- what is equipped, the quest, the season's experience, the three
-- settings), uploaded a little after anything changes and read back
-- after a reinstall. Written and read only by
-- hq/src/app/api/players/save/route.ts, which checks the device secret
-- first, exactly as player_profiles and friendships are.
--
-- The website does NOT depend on this file being applied: until it is,
-- a save and a load both answer 503, which the game reads as "try again
-- later", and it carries on as it did before. Apply it, then deploy the
-- site, then publish the game update.
--
-- Safe to run more than once. Contains no DROP. NOT applied by the agent
-- that wrote it; somebody with database access applies it.

create table if not exists public.player_saves (
  player_id    text primary key references public.player_profiles (player_id) on delete cascade,
  snapshot     jsonb not null,
  saved_at     timestamptz not null default now(),
  game_version text not null default ''
);

-- The route refuses anything over 64 KB of JSON before it gets here
-- (hq/src/lib/playerSave.ts). This is a backstop at twice that, kept by
-- the table itself so nothing else can write something enormous: jsonb's
-- text form is spaced differently from the JSON the route measured, so
-- the same number here would refuse a snapshot the route had passed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_saves_snapshot_size'
      and conrelid = 'public.player_saves'::regclass
  ) then
    alter table public.player_saves
      add constraint player_saves_snapshot_size
      check (octet_length(snapshot::text) <= 131072);
  end if;
end $$;

-- No policies: every read and write goes through the HQ API with the
-- service key, which checks the device secret first — the same
-- arrangement player_profiles, friendships and match_queue have. A
-- player's row goes with their profile when that is deleted on request.
alter table public.player_saves enable row level security;
