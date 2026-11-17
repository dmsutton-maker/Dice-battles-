-- Where the studio's apps sit in the App Store, read once a day: their place in Apple's overall
-- Top Paid and Top Free charts (the top 100, all categories together, United States), and their
-- place in Apple's search results for a few search words each (Apple's iTunes Search API, which is
-- close to, but not guaranteed identical to, what the App Store app shows for the same words).
--
-- Filled by /api/cron/app-sales once a day (hq/src/lib/appRankings.ts), only for apps that are on
-- the US App Store that day, and shown on David's sales dashboard. Re-reading the same day replaces
-- that day's rows. Nobody but the server reads or writes this table: row-level security is on with
-- no policies.

create table if not exists public.app_rankings (
  -- The day it was read (UTC).
  day           date not null,
  -- The app, by App Store id, and its name.
  app_apple_id  text not null,
  app_name      text not null,
  -- 'chart' for Apple's Top Paid / Top Free lists, 'search' for a search.
  kind          text not null check (kind in ('chart', 'search')),
  -- Which list: 'Top Paid', 'Top Free', or the search words (e.g. 'watch faces').
  name          text not null,
  country       text not null default 'us',
  -- Its place in the list, 1 being the top. Empty (null) means it was not in the list at all.
  rank          integer,
  -- How many places Apple's list had that day, so "not in the list" means "not in the top N".
  list_length   integer not null,
  fetched_at    timestamptz not null default now(),
  primary key (day, app_apple_id, kind, name, country)
);

create index if not exists app_rankings_app_day_idx on public.app_rankings (app_apple_id, day);

alter table public.app_rankings enable row level security;
