-- Money in one currency, and the money ads earn.
--
-- David, 24 Nov 2026: "the total dollars should be global money ... if money came in from other
-- country just convert to usd. also can the dice battles also check revenue that comes from ads
-- as well?"
--
-- 1. fx_rates: what one unit of a currency was worth in US dollars on a day. Filled by the daily
--    sales jobs (lib/fxRates.ts) for every currency and day the store reports mention, from the
--    European Central Bank's daily reference rates (Frankfurter), with a fallback source for
--    currencies the ECB does not publish. `to_usd()` converts with the rate of that day, or the
--    nearest earlier one (weekends and holidays have no ECB rate).
--    These are market rates: Apple and Google pay out at their own monthly rates, so a converted
--    figure is close to, not exactly, the payout.
-- 2. admob_earnings: AdMob's estimated earnings per app, platform and day, in US dollars (AdMob
--    converts them itself). Filled by lib/admob.ts once AdMob is connected from /admin/sales.
-- 3. studio_secrets: the AdMob sign-in (an OAuth refresh token). Server only.
--
-- Nobody but the server reads or writes these tables: row-level security is on with no policies.

create table if not exists public.fx_rates (
  day           date not null,
  currency      text not null,
  usd_per_unit  numeric not null check (usd_per_unit > 0),
  source        text not null default '',
  fetched_at    timestamptz not null default now(),
  primary key (currency, day)
);

alter table public.fx_rates enable row level security;

-- One US dollar is one US dollar, every day.
create or replace function public.to_usd(amount numeric, currency text, on_day date)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when amount is null then null
    when amount = 0 then 0
    when coalesce(currency, '') in ('', 'USD') then amount
    else amount * coalesce(
      (select r.usd_per_unit from public.fx_rates r
        where r.currency = upper(to_usd.currency) and r.day <= on_day
        order by r.day desc limit 1),
      (select r.usd_per_unit from public.fx_rates r
        where r.currency = upper(to_usd.currency)
        order by r.day asc limit 1))
  end
$$;

create table if not exists public.admob_earnings (
  day               date not null,
  app_id            text not null,
  app_name          text not null,
  platform          text not null default '',
  earnings_usd      numeric not null default 0,
  impressions       integer not null default 0,
  ad_requests       integer not null default 0,
  matched_requests  integer not null default 0,
  fetched_at        timestamptz not null default now(),
  primary key (day, app_id)
);

create index if not exists admob_earnings_app_idx on public.admob_earnings (app_name, day);

alter table public.admob_earnings enable row level security;

create table if not exists public.admob_syncs (
  id            bigint generated always as identity primary key,
  ran_at        timestamptz not null default now(),
  source        text not null,
  ok            boolean not null,
  rows_written  integer not null default 0,
  latest_day    date,
  message       text not null default ''
);

create index if not exists admob_syncs_ran_idx on public.admob_syncs (ran_at desc);

alter table public.admob_syncs enable row level security;

create table if not exists public.studio_secrets (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.studio_secrets enable row level security;

revoke all on public.fx_rates, public.admob_earnings, public.admob_syncs, public.studio_secrets from anon, authenticated;
