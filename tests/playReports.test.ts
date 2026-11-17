import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { assert, assertEqual, suite, test } from './harness';
import * as play from '../hq/src/lib/playReports';

/**
 * Google Play downloads and sales on David's sales dashboard: the reading of Google's report files.
 *
 * David, 17 Nov 2026: "can the paper ship studio artifact also track google play and also track
 * downloads for lease dash ... and for dice battles i want to see income from in app purchases as
 * well". The route needs Google and Supabase, so it is read as source; what it reads files with is
 * pure and is run here on files built to Google's documented layout.
 */

const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** A .zip of the given files, deflated, as Google's sales reports come. */
function zip(files: { name: string; text: string }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const raw = Buffer.from(f.text);
    const packed = deflateRawSync(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += 30 + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const utf16 = (text: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]);

suite('Google Play reports · downloads', () => {
  test('the overview file, in UTF-16 as Google writes it, gives a row a day', () => {
    const csv = [
      'Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Daily Device Upgrades,Total User Installs,Daily User Installs,Daily User Uninstalls,Installs on active devices,Install events,Update events,Uninstall events',
      '2026-11-15,com.dmsutton.dicebattles,4,0,0,9,3,1,8,5,0,1',
      '2026-11-16,com.dmsutton.dicebattles,2,1,0,11,2,0,9,2,0,1',
    ].join('\n');
    const rows = play.parseInstalls(play.decodeText(utf16(csv)), 'com.dmsutton.dicebattles');
    assertEqual(rows.length, 2, 'two days');
    assertEqual(rows[0].day, '2026-11-15', 'the first day');
    assertEqual(rows[0].app_name, 'Dice Battles: Color Rush', 'named as the App Store names it');
    assertEqual(rows[0].daily_user_installs, 3, 'new users that day');
    assertEqual(rows[1].active_device_installs, 9, 'installs on active devices');
  });

  test('a country file is added up into one row a day', () => {
    const csv = [
      'Date,Package Name,Country,Daily Device Installs,Daily User Installs',
      '2026-11-15,com.example.leasedash,US,3,2',
      '2026-11-15,com.example.leasedash,CA,1,1',
      '2026-11-16,com.example.leasedash,US,0,0',
    ].join('\r\n');
    const rows = play.parseInstalls(csv, 'com.example.leasedash');
    assertEqual(rows.length, 2, 'two days');
    assertEqual(rows[0].daily_user_installs, 3, 'US and Canada together');
    assertEqual(rows[1].daily_user_installs, 0, 'a real zero stays zero');
    assertEqual(rows[0].install_events, null, 'a number Google left out is not made a zero');
    assertEqual(rows[0].app_name, 'LeaseDash CRM', 'any LeaseDash package is LeaseDash CRM');
  });

  test('the overview is read when there is one, the country file when there is not, and only recent months', () => {
    const chosen = play.pickInstallFiles(
      [
        'stats/installs/installs_com.dmsutton.dicebattles_202611_country.csv',
        'stats/installs/installs_com.dmsutton.dicebattles_202611_overview.csv',
        'stats/installs/installs_com.dmsutton.dicebattles_202611_device.csv',
        'stats/installs/installs_com.papershipstudio.vectorfaces_202611_country.csv',
        'stats/installs/installs_com.papershipstudio.vectorfaces_202608_overview.csv',
      ],
      new Set(['202610', '202611']),
    );
    assertEqual(chosen.size, 2, 'one file per app per month, recent months only');
    assert(chosen.get('com.dmsutton.dicebattles|202611')?.name.endsWith('_overview.csv') === true, 'the overview wins');
    assert(chosen.get('com.papershipstudio.vectorfaces|202611')?.name.endsWith('_country.csv') === true, 'else the country file');
  });

  test('the bucket setting takes one name, a gs:// address, or several to try', () => {
    assertEqual(play.bucketNames('gs://pubsite_prod_rev_123/stats/installs/').join('|'), 'pubsite_prod_rev_123', 'a copied address');
    assertEqual(play.bucketNames('pubsite_prod_rev_1, pubsite_prod_1').join('|'), 'pubsite_prod_rev_1|pubsite_prod_1', 'two to try');
    assertEqual(play.bucketNames('  ').length, 0, 'none yet');
  });

  test('recent months count back across a new year', () => {
    assertEqual(play.recentMonths(new Date('2027-01-10T00:00:00Z'), 2).join(','), '202611,202612,202701', 'three months');
  });
});

suite('Google Play reports · sales', () => {
  const header =
    'Order Number,Order Charged Date,Order Charged Timestamp,Financial Status,Device Model,Product Title,Package ID,Product Type,SKU ID,Currency of Sale,Item Price,Taxes Collected,Charged Amount,City of Buyer,State of Buyer,Postcode of Buyer,Country of Buyer';
  const csv = [
    header,
    'GPA.1111-2222,2026-11-16,1794800000,Charged,pixel,"Gold Pass (Dice Battles: Color Rush)",com.dmsutton.dicebattles,inapp,gold_pass,USD,2.99,0.18,3.17,,NJ,,US',
    'GPA.3333-4444,2026-11-16,1794800100,Charged,pixel,"Unlock all designs (Vector Faces)",com.papershipstudio.vectorfaces,inapp,unlock_all,GBP,1.99,0,1.99,,,,GB',
    'GPA.3333-4444,2026-11-17,1794890000,Refund,pixel,"Unlock all designs (Vector Faces)",com.papershipstudio.vectorfaces,inapp,unlock_all,GBP,1.99,0,1.99,,,,GB',
  ].join('\n');

  test('a zipped month comes out as one row per order line', () => {
    const files = play.unzip(zip([{ name: 'salesreport_202611.csv', text: csv }]));
    assertEqual(files.length, 1, 'one file in the zip');
    const rows = play.parseSales(play.decodeText(files[0].data));
    assertEqual(rows.length, 3, 'three lines');
    assertEqual(rows[0].app_name, 'Dice Battles: Color Rush', 'the package names the app');
    assertEqual(rows[0].sku_id, 'gold_pass', 'the in-app product');
    assertEqual(rows[0].item_price, 2.99, 'the price before tax');
    assertEqual(rows[0].est_proceeds, 2.54, "2.99 less Google's 15%");
    assertEqual(rows[0].product_title, 'Gold Pass (Dice Battles: Color Rush)', 'a quoted cell keeps its comma-free text');
    assertEqual(rows[2].financial_status, 'Refund', 'a refund is kept as its own line');
  });

  test('the month is read from the file name', () => {
    assertEqual(play.fileMonth('sales/salesreport_202611.zip'), '202611', 'sales');
    assertEqual(play.fileMonth('stats/installs/installs_com.a.b_202611_overview.csv'), '202611', 'installs');
  });
});

suite('Google Play reports · the daily copy', () => {
  const route = read('hq/src/app/api/cron/play-reports/route.ts');
  const lib = read('hq/src/lib/playReports.ts');
  const vercel = JSON.parse(read('hq/vercel.json')) as { crons: { path: string }[] };
  const migration = read('hq/supabase/migrations/20261117_play_reports.sql');

  test('it runs every day, behind the cron secret', () => {
    assert(vercel.crons.some((c) => c.path === '/api/cron/play-reports'), 'vercel.json schedules it');
    assert(route.includes('CRON_SECRET') && route.includes('timingSafeEqual'), 'only the scheduler may call it');
  });

  test('it signs in to Google with no key file, read-only', () => {
    assert(route.includes('x-vercel-oidc-token'), "Vercel's own token is what it signs in with");
    assert(lib.includes('devstorage.read_only'), 'the Google token can only read Cloud Storage');
    assert(!/private_key|GOOGLE_APPLICATION_CREDENTIALS|client_email/.test(lib + route), 'no service account key anywhere');
  });

  test('the answer never contains the sign-in token itself', () => {
    assert(/identity = claims \? \{ iss: claims\.iss, aud: claims\.aud, sub: claims\.sub \}/.test(route), 'only the issuer, audience and subject');
    assert(!/json\(\{[^}]*\boidc\b/.test(route), 'the token is never put in the answer');
  });

  test('the tables are for the server alone', () => {
    for (const table of ['play_installs', 'play_sales', 'play_report_syncs']) {
      assert(migration.includes(`alter table public.${table} enable row level security`), `${table} has row-level security`);
    }
    assert(/revoke all on function public\.replace_play_installs/.test(migration), 'only the server replaces installs');
    assert(/revoke all on function public\.replace_play_sales/.test(migration), 'only the server replaces sales');
  });
});
