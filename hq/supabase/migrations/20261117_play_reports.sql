-- Google Play downloads and sales for every app on the Google Play developer account (Vector
-- Faces for Wear OS, Dice Battles: Color Rush, LeaseDash CRM), from the reports Google Play puts
-- in its Cloud Storage bucket for the account (Play Console, Download reports).
--
-- Filled by /api/cron/play-reports once a day, and shown on David's sales dashboard. Each run
-- re-reads the current and recent months whole, because Google rewrites a month's files as it
-- goes, and replaces them (`replace_play_installs`, `replace_play_sales`), so nothing is counted
-- twice. Nobody but the server reads or writes these tables: row-level security is on with no
-- policies.

-- One row per app per day: the installs statistics file (stats/installs/..._overview.csv).
create table if not exists public.play_installs (
  package                 text not null,
  app_name                text not null,
  day                     date not null,
  -- The month's file the row came from, as YYYYMM: a re-read replaces exactly that file's rows.
  report_month            text not null,
  -- New users who installed the app for the first time on any device: the nearest thing Google
  -- has to the App Store's first-time downloads.
  daily_user_installs     integer,
  daily_device_installs   integer,
  install_events          integer,
  daily_user_uninstalls   integer,
  active_device_installs  integer,
  fetched_at              timestamptz not null default now(),
  primary key (package, day)
);

create index if not exists play_installs_day_idx on public.play_installs (day);

alter table public.play_installs enable row level security;

-- One row per order line in Google's estimated sales report (sales/salesreport_YYYYMM.zip): every
-- paid app sale and in-app purchase, in the buyer's currency. A refund or chargeback may come as a
-- row of its own with the same order number; the dashboard counts an order only while none of its
-- rows says it was refunded.
create table if not exists public.play_sales (
  order_number      text not null,
  financial_status  text not null,
  sku_id            text not null default '',
  report_month      text not null,
  day               date not null,
  package           text not null,
  app_name          text not null,
  product_title     text not null default '',
  -- Google's product type: a paid app, an in-app product or a subscription.
  product_type      text not null default '',
  currency          text not null default '',
  -- The price before tax, and the tax and total the buyer was charged, in `currency`.
  item_price        numeric not null default 0,
  taxes             numeric not null default 0,
  charged_amount    numeric not null default 0,
  country           text not null default '',
  -- What the studio is paid for it after Google's service fee (15%), in `currency`. An estimate:
  -- Google's own figure arrives once a month in the earnings report.
  est_proceeds      numeric not null default 0,
  fetched_at        timestamptz not null default now(),
  primary key (order_number, financial_status, sku_id)
);

create index if not exists play_sales_day_idx on public.play_sales (day);
create index if not exists play_sales_app_idx on public.play_sales (app_name, day);

alter table public.play_sales enable row level security;

-- Every run, whether it worked and what Google said if not, so the dashboard can say how fresh
-- the Google Play numbers are.
create table if not exists public.play_report_syncs (
  id                  bigint generated always as identity primary key,
  ran_at              timestamptz not null default now(),
  source              text not null,
  files_read          integer not null default 0,
  rows_written        integer not null default 0,
  latest_install_day  date,
  latest_sale_day     date,
  ok                  boolean not null,
  message             text not null default ''
);

create index if not exists play_report_syncs_ran_idx on public.play_report_syncs (ran_at desc);

alter table public.play_report_syncs enable row level security;

-- Replaces one app's month of installs in one step. `rows` is a JSON array of objects with the
-- play_installs columns (no report_month or fetched_at).
create or replace function public.replace_play_installs(pkg text, month text, rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  written integer;
begin
  delete from public.play_installs where package = pkg and report_month = month;
  insert into public.play_installs (package, app_name, day, report_month, daily_user_installs,
                                    daily_device_installs, install_events, daily_user_uninstalls,
                                    active_device_installs)
  select pkg, r.app_name, r.day, month, r.daily_user_installs, r.daily_device_installs,
         r.install_events, r.daily_user_uninstalls, r.active_device_installs
  from jsonb_to_recordset(coalesce(rows, '[]'::jsonb)) as r(
    app_name text, day date, daily_user_installs integer, daily_device_installs integer,
    install_events integer, daily_user_uninstalls integer, active_device_installs integer)
  on conflict (package, day) do update set
    app_name = excluded.app_name, report_month = excluded.report_month,
    daily_user_installs = excluded.daily_user_installs,
    daily_device_installs = excluded.daily_device_installs,
    install_events = excluded.install_events,
    daily_user_uninstalls = excluded.daily_user_uninstalls,
    active_device_installs = excluded.active_device_installs,
    fetched_at = now();
  get diagnostics written = row_count;
  return written;
end;
$$;

-- Replaces one month's sales report in one step (every app on the account is in the one file).
create or replace function public.replace_play_sales(month text, rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  written integer;
begin
  delete from public.play_sales where report_month = month;
  insert into public.play_sales (order_number, financial_status, sku_id, report_month, day, package,
                                 app_name, product_title, product_type, currency, item_price, taxes,
                                 charged_amount, country, est_proceeds)
  select r.order_number, r.financial_status, coalesce(r.sku_id, ''), month, r.day, r.package,
         r.app_name, coalesce(r.product_title, ''), coalesce(r.product_type, ''),
         coalesce(r.currency, ''), coalesce(r.item_price, 0), coalesce(r.taxes, 0),
         coalesce(r.charged_amount, 0), coalesce(r.country, ''), coalesce(r.est_proceeds, 0)
  from jsonb_to_recordset(coalesce(rows, '[]'::jsonb)) as r(
    order_number text, financial_status text, sku_id text, day date, package text, app_name text,
    product_title text, product_type text, currency text, item_price numeric, taxes numeric,
    charged_amount numeric, country text, est_proceeds numeric)
  on conflict (order_number, financial_status, sku_id) do update set
    report_month = excluded.report_month, day = excluded.day, package = excluded.package,
    app_name = excluded.app_name, product_title = excluded.product_title,
    product_type = excluded.product_type, currency = excluded.currency,
    item_price = excluded.item_price, taxes = excluded.taxes,
    charged_amount = excluded.charged_amount, country = excluded.country,
    est_proceeds = excluded.est_proceeds, fetched_at = now();
  get diagnostics written = row_count;
  return written;
end;
$$;

-- Only the server may call them.
revoke all on function public.replace_play_installs(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.replace_play_sales(text, jsonb) from public, anon, authenticated;
