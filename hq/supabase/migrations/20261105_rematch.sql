-- The rematch, 5 Nov 2026.
--
-- Marc: "After a game against your friend, if one of you chooses to play
-- again, it should have to wait for the other player too in order to be
-- able to play again, because right now it plays again against your
-- friend but they're not playing really."
--
-- "Play again" after a live battle is now an INVITE, exactly like a
-- challenge: a battle_invites row from whoever asked to the other
-- player, with the finished battle's mode and difficulty, that the other
-- player has to accept before anything starts (hq/src/app/api/battles,
-- action 'rematch'). The only thing the table did not have is a way to
-- say WHICH battle an invite is the rematch of — so that asking twice
-- finds the invite already sent, and two people who both ask at the same
-- moment end up with one battle rather than two. That is this column.
--
-- Null for every ordinary challenge. The route reads invites with `*`
-- and inserts the column only for a rematch, so the website can be
-- deployed before this is applied: challenges work as before, and
-- "Play again with Marc" answers "could not send that" until it is.
--
-- No new table, so no new policies: battle_invites already has row level
-- security on with no policies, every read and write going through the
-- HQ API with the service key (schema.sql). Restated below so a project
-- rebuilt from the migrations alone is in the same state.
--
-- Safe to run more than once. Contains no DROP. NOT applied by the agent
-- that wrote it; somebody with database access applies it, BEFORE the
-- website is deployed and the game updated.

alter table public.battle_invites
  add column if not exists rematch_of uuid null
    references public.battles (id) on delete set null;

comment on column public.battle_invites.rematch_of is
  'The finished battle this invite asks to play again, or null for an ordinary challenge.';

-- The lookup the route makes on every rematch ask: the open invites for
-- one finished battle, in either direction.
create index if not exists battle_invites_rematch_idx
  on public.battle_invites (rematch_of) where (state = 'waiting');

alter table public.battle_invites enable row level security;
