-- The friendly-battle clock, 1 Nov 2026.
--
-- David: "Add a two minute thirty second timer and if the game doesn't
-- finish by then it is a tie if the score is tied, or a win for whoever
-- is winning at that moment."
--
-- The server ends a friendly battle when its clock runs out
-- (hq/src/lib/battleClock.ts). A win is written to `winner` as the
-- player_id, exactly as before. A TIE is written as the word 'tie' rather
-- than left null, because null means "still being played" to every
-- version of the game ever shipped, and a tie left null would leave both
-- phones racing a battle that is over.
--
-- `winner` is plain text, so 'tie' already fits and the code does NOT
-- depend on this file: it is safe to deploy the website before this is
-- applied. What it adds is the database saying so, and refusing anything
-- else: a winner is nobody yet, 'tie', or one of the two players.
--
-- NOT VALID, so no existing row is re-checked (every existing winner is
-- null or a player in that battle, but there is no reason to scan the
-- table to prove it). New and updated rows are checked. Safe to run more
-- than once. Contains no DROP, so the Supabase connector applies it
-- without holding it for approval.

comment on column public.battles.winner is
  'Null while playing (or ended with no result); the winning player_id; or ''tie'' when the clock ran out level.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'battles_winner_is_a_player_or_tie'
      and conrelid = 'public.battles'::regclass
  ) then
    alter table public.battles
      add constraint battles_winner_is_a_player_or_tie
      check (winner is null or winner = 'tie' or winner = a_id or winner = b_id)
      not valid;
  end if;
end $$;
