import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { assert, assertEqual, note, suite, test } from './harness';

/**
 * Push notifications, and the switch that keeps them from crashing the
 * game before they exist.
 *
 * David, 25 Sep 2026: "make push notifications for when there's a new
 * update."
 *
 * Everything around it is built and deployed — the table, the register
 * endpoint, the announce endpoint, src/game/push.ts. The one remaining
 * step needs a NEW BINARY, because expo-notifications is native code,
 * and a build cannot be made from a session: `eas build
 * --non-interactive` stops at "Distribution Certificate is not
 * validated for non-interactive builds".
 *
 * So the module sits in the OFF position, and this suite is what stops
 * somebody turning half of it on. Half is the crash: Metro bundles a
 * `require()` with a literal string whether or not it ever runs,
 * expo-notifications reaches for its native side at module scope, and a
 * try/catch does NOT save you — Metro's loader catches the throw first
 * and escalates it to a red screen. That is not a theory; it is what
 * happened to this game on 25 Aug 2026.
 */

/** Source with comments removed — this file's own prose names the package. */
function liveSourceFiles(): [string, string][] {
  return execSync("find src -name '*.ts' -o -name '*.tsx'", { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.trim().length > 0)
    .map((file) => [
      file,
      readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, ''),
    ]);
}

/** Is the push switch on? The one line that decides everything else. */
function pushOn(): boolean {
  const code = readFileSync('src/game/pushSdk.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return /require\('expo-notifications'\)/.test(code);
}

suite('push · the switch is never half on', () => {
  const app = JSON.parse(readFileSync('app.json', 'utf8'));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

  test('the package, the require and runtimeVersion all agree', () => {
    /*
      THREE THINGS, ONE STATE.

        PUSH OFF — no require anywhere, no expo-notifications in
                   package.json, and runtimeVersion left where it is.
                   Every install keeps receiving updates.
        PUSH ON  — the require is back, the package is installed, the
                   config plugin is in app.json, and runtimeVersion has
                   been RAISED for a binary that contains the native
                   side. Old installs correctly stop at the last update
                   matching their runtime, which is why a build has to
                   follow in the same breath.

      Any mixture of the two is the red screen. That is why this is a
      test and not a line in a checklist.
    */
    const on = pushOn();
    const installed = 'expo-notifications' in (pkg.dependencies ?? {});
    const runtime = app.expo.runtimeVersion;
    note(`push ${on ? 'ON' : 'OFF'}, package ${installed ? 'installed' : 'absent'}, runtimeVersion ${JSON.stringify(runtime)}`);

    assertEqual(
      on,
      installed,
      on
        ? 'the require is back but expo-notifications is not a dependency — the bundle would not even build'
        : 'expo-notifications is installed but nothing requires it — either finish turning it on or take it out',
    );

    if (on) {
      assert(
        typeof runtime === 'string' && /^\d+\.\d+\.\d+$/.test(runtime),
        `push is on but runtimeVersion is ${JSON.stringify(runtime)} — a policy cannot know that native code changed`,
      );
      assert(
        JSON.stringify(app.expo.plugins ?? []).includes('expo-notifications'),
        'the expo-notifications config plugin is gone — the native module would not be in the binary',
      );
    }
  });

  test('while push is off, the module is in no file Metro will follow', () => {
    /*
      Metro includes a module because something requires it with a
      literal string, whether or not that line ever runs. So "push is
      off" has to mean the string is in no LIVE code anywhere in src —
      not merely that the one call site is behind a flag. A guarded
      require still ships the module, and anything that reached it would
      still crash.

      Comments are stripped first, because pushSdk.ts explains all of
      this in prose and names the package several times. Grepping the
      raw text finds its own documentation and fails — which is exactly
      how the ad SDK's version of this test failed the first time.
    */
    if (pushOn()) return;
    const named = liveSourceFiles().filter(([, code]) =>
      code.includes('expo-notifications'),
    );
    assertEqual(
      named.map(([f]) => f).join(', '),
      '',
      'expo-notifications is named in live code while push is off',
    );
  });

  test('only one file may reach the notifications module', () => {
    // The rule ads.ts and gameCenter.ts already follow. A second caller
    // is a second place to get the crash-avoidance wrong.
    const users = liveSourceFiles().filter(
      ([file, code]) =>
        code.includes('loadPushSdk') && !file.endsWith('pushSdk.ts'),
    );
    assertEqual(
      users.map(([f]) => f).join(', '),
      'src/game/push.ts',
      'something other than push.ts is loading the notifications module',
    );
  });
});

suite('push · nothing about it may break the game', () => {
  const source = readFileSync('src/game/push.ts', 'utf8');

  test('every path through it is caught', () => {
    /*
      The same promise ads.ts makes. A permission prompt that never
      answers, a token fetch that throws on a binary without the
      module, a register call with no network — all of them have to end
      as "no notifications", never as a crash and never as a wait.
    */
    const bodies = source.split(/\nexport (?:async )?function /).slice(1);
    assert(bodies.length >= 4, 'push.ts lost its functions');
    for (const body of bodies) {
      const name = body.slice(0, body.indexOf('('));
      assert(
        /try \{/.test(body) && /\} catch/.test(body),
        `${name} has no catch — a failure there would reach the player`,
      );
    }
    note(`${bodies.length} exported functions, all guarded`);
  });

  test('it asks permission from Settings, never at launch', () => {
    /*
      iOS gives an app ONE chance at the permission prompt, for good. A
      prompt on first launch — before a child has seen a die roll — is
      the one most likely to be refused forever, and there is no second
      ask. refreshToken is the launch-safe half: it re-registers when
      permission is already held and prompts for nothing.
    */
    assert(
      !/requestPermissionsAsync/.test(source.split('export async function refreshToken')[1] ?? ''),
      'refreshToken prompts, so a launch could put a permission dialog over the game',
    );
    assert(
      /requestPermissionsAsync/.test(source.split('export async function askToBeTold')[1] ?? ''),
      'askToBeTold no longer asks for anything',
    );
  });

  test('there is no way to notify one player rather than everybody', () => {
    /*
      One message exists — "a new version is out" — and it goes to
      everybody at once. Not a limitation: an endpoint that could pick a
      player would be an endpoint that could be made to, and this game
      ships to children.
    */
    const announce = readFileSync('hq/src/app/api/push/announce/route.ts', 'utf8');
    assert(
      !/playerId/.test(announce),
      'the announce endpoint can now address a single player',
    );
    assert(
      /x-hq-token/.test(announce),
      'the announce endpoint is no longer behind the HQ token',
    );
  });
});
