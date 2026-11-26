-- App Store sales for every Paper Ship Studio app (Vector Faces, Dice Battles: Color Rush, and
-- any app added to the account later), from Apple's Sales and Trends daily summary reports.
--
-- Filled by /api/cron/app-sales once a day (it re-reads the last week, since Apple sometimes
-- corrects a day), and shown on /admin/sales (owner only) and David's sales dashboard.
-- Nobody but the server reads or writes these tables: row-level security is on with no policies.

create table if not exists public.app_sales (
  id                 bigint generated always as identity primary key,
  -- The day the sales happened, Pacific time, as Apple reports it.
  report_date        date not null,
  -- The app the row belongs to: the app itself, or the app an in-app purchase is part of.
  app_apple_id       text not null,
  app_name           text not null,
  -- What was sold: the app, or one in-app purchase (Apple's "Apple Identifier", "Title", "SKU").
  item_apple_id      text not null,
  item_title         text not null,
  sku                text not null default '',
  -- Apple's Product Type Identifier (1, 1F, 3, 7, IA1, IA9, ...), and what it means here.
  product_type       text not null,
  kind               text not null
                     check (kind in ('paid_download', 'free_download', 'redownload', 'update',
                                     'in_app_purchase', 'other')),
  -- How many. Negative for refunds.
  units              integer not null,
  -- What the customer paid for one, and what Paper Ship Studio receives for one after Apple's share.
  customer_price     numeric not null default 0,
  customer_currency  text not null default '',
  proceeds           numeric not null default 0,
  proceeds_currency  text not null default '',
  country            text not null default '',
  device             text not null default '',
  promo_code         text not null default '',
  fetched_at         timestamptz not null default now()
);

create index if not exists app_sales_date_idx on public.app_sales (report_date);
create index if not exists app_sales_app_date_idx on public.app_sales (app_apple_id, report_date);

alter table public.app_sales enable row level security;

-- Every time the sales were fetched, whether it worked, and what Apple said if not, so the admin
-- page can say how fresh the numbers are instead of guessing.
create table if not exists public.app_sales_syncs (
  id                  bigint generated always as identity primary key,
  ran_at              timestamptz not null default now(),
  source              text not null,
  days_checked        integer not null default 0,
  rows_written        integer not null default 0,
  latest_report_date  date,
  ok                  boolean not null,
  message             text not null default ''
);

create index if not exists app_sales_syncs_ran_idx on public.app_sales_syncs (ran_at desc);

alter table public.app_sales_syncs enable row level security;

-- Replaces one day's rows in one step, so a re-read never leaves a day half written or counted
-- twice. `rows` is a JSON array of objects with the app_sales columns (no id or fetched_at).
create or replace function public.replace_app_sales_day(day date, rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  written integer;
begin
  delete from public.app_sales where report_date = day;
  insert into public.app_sales (report_date, app_apple_id, app_name, item_apple_id, item_title, sku,
                                product_type, kind, units, customer_price, customer_currency,
                                proceeds, proceeds_currency, country, device, promo_code)
  select day, r.app_apple_id, r.app_name, r.item_apple_id, r.item_title, coalesce(r.sku, ''),
         r.product_type, r.kind, r.units, coalesce(r.customer_price, 0), coalesce(r.customer_currency, ''),
         coalesce(r.proceeds, 0), coalesce(r.proceeds_currency, ''), coalesce(r.country, ''),
         coalesce(r.device, ''), coalesce(r.promo_code, '')
  from jsonb_to_recordset(coalesce(rows, '[]'::jsonb)) as r(
    app_apple_id text, app_name text, item_apple_id text, item_title text, sku text,
    product_type text, kind text, units integer, customer_price numeric, customer_currency text,
    proceeds numeric, proceeds_currency text, country text, device text, promo_code text);
  get diagnostics written = row_count;
  return written;
end;
$$;

-- Only the server may call it.
revoke all on function public.replace_app_sales_day(date, jsonb) from public, anon, authenticated;
