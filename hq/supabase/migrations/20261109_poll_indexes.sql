-- 9 Nov 2026, from Supabase's performance advisor during the launch audit:
-- the two foreign keys the live polls look up by had no covering index.
-- Applied to the live database the same day through the Supabase connector.
create index if not exists battles_b_id_idx on public.battles (b_id);
create index if not exists friendships_other_id_idx on public.friendships (other_id);
