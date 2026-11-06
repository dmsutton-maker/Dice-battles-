import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { oneFromWinning } from '../src/game/musicIntensity';
import {
  BATTLE_TRACKS,
  nextBattleTrack,
  parseStoredTrack,
  ROTATION_STORAGE_KEY,
} from '../src/game/musicRotation';
import { assert, assertEqual, suite, test } from './harness';

/*
  The game's own soundtrack. Marc, 5 Nov 2026: "Music should be fast paced
  and energetic and exciting and owned completely by us so it needs to be
  original" ... "Not just endgame music, all music for the game" ... "what
  about it changing like as there's only like one more player to save then
  it gets a little bit more intense and also give me slower version of A
  maybe to be the lobby music" ... "the three that we chose could rotate
  between the games" ... "give a little nice synthesized excitement when
  they purchase something".

  The pure rules are tested as rules; the wiring is pinned by reading the
  source, since the players themselves only exist on a phone.
*/
const root = join(__dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** The body of one top-level `export function name(` in a source file. */
function fn(source: string, name: string): string {
  const match = new RegExp(`export (?:async )?function ${name}\\(`).exec(source);
  assert(match !== null, `no function ${name}`);
  const start = match!.index;
  const next = source.indexOf('\nexport ', start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

suite('music · the build-up rule', () => {
  test('either side one rescue from winning turns the music hot', () => {
    assert(oneFromWinning(5, 0, 6), 'I am one from winning');
    assert(oneFromWinning(0, 5, 6), 'the rival is one from winning');
    assert(oneFromWinning(5, 5, 6), 'both are');
    assert(oneFromWinning(2, 0, 3), 'Color War: two of three');
    assert(oneFromWinning(1, 2, 3), 'Color War: the rival has two of three');
  });

  test('and not before', () => {
    assert(!oneFromWinning(0, 0, 6), 'nothing rescued yet');
    assert(!oneFromWinning(4, 4, 6), 'two from winning, both sides');
    assert(!oneFromWinning(1, 1, 3), 'Color War: one each');
  });

  test('a battle already won still counts as hot, never as cool', () => {
    // The last rescue and the finish land in the same render; the rule
    // must not flip back on the way out.
    assert(oneFromWinning(6, 0, 6), 'six of six');
    assert(oneFromWinning(0, 3, 3), 'three of three');
  });

  test('Skirmish asks whether one prisoner is left in the shared jail', () => {
    // The screen passes everything taken, by anybody, as "mine".
    assert(oneFromWinning(5, 0, 6), 'one left in jail');
    assert(!oneFromWinning(4, 0, 6), 'two left in jail');
  });

  test('a nonsense total is never hot', () => {
    assert(!oneFromWinning(0, 0, 1), 'a one-rescue game would be hot from the start');
    assert(!oneFromWinning(0, 0, 0), 'zero');
    assert(!oneFromWinning(0, 0, Number.NaN), 'NaN');
  });
});

suite('music · the rotation', () => {
  test('the three battle tracks take turns, in order, and round again', () => {
    assertEqual(BATTLE_TRACKS.length, 3, 'three tracks');
    assertEqual(nextBattleTrack('pixel'), 'brass', 'after Pixel Rush');
    assertEqual(nextBattleTrack('brass'), 'neon', 'after Brass Chase');
    assertEqual(nextBattleTrack('neon'), 'pixel', 'after Neon Sprint');
  });

  test('nothing played yet starts at Pixel Rush', () => {
    assertEqual(nextBattleTrack(null), 'pixel', 'null');
    assertEqual(nextBattleTrack(undefined), 'pixel', 'undefined');
  });

  test('what is in storage is believed only when it is one of the three', () => {
    assertEqual(parseStoredTrack('brass'), 'brass', 'a real track');
    assertEqual(parseStoredTrack('polka'), null, 'an old track name');
    assertEqual(parseStoredTrack(''), null, 'empty');
    assertEqual(parseStoredTrack(null), null, 'nothing stored');
    assertEqual(parseStoredTrack(7), null, 'a number');
    assertEqual(nextBattleTrack(parseStoredTrack('junk')), 'pixel', 'junk starts at the top');
    assertEqual(ROTATION_STORAGE_KEY, 'dice-battles:music-rotation', 'the storage key');
  });

  test('sounds.ts draws from the rotation and writes the position down', () => {
    const audio = read('src/audio/sounds.ts');
    assert(/nextBattleTrack\(rotationTrack\)/.test(audio), 'a battle does not take the next track');
    assert(
      /AsyncStorage\.setItem\(ROTATION_STORAGE_KEY, track\)/.test(audio),
      'the position is not written when a track starts',
    );
    assert(
      /AsyncStorage\.getItem\(ROTATION_STORAGE_KEY\)/.test(audio),
      'the position is not read at init',
    );
    const init = fn(audio, 'initSounds');
    assert(/readRotation\(\)/.test(init), 'the rotation is not read once at init');
    // Resuming the same battle must not advance it: the scene is only
    // acted on when it CHANGES, and a battle already begun is kept.
    const scene = fn(audio, 'setMusicScene');
    assert(/if \(next === scene\) return;/.test(scene), 'saying the same scene twice restarts the music');
    assert(/scene === 'battle' && !battleBegun/.test(audio), 'a paused battle would draw a new track');
    assert(!/Math\.random/.test(audio), 'the music is picked at random, not in rotation');
  });
});

suite('music · the files', () => {
  const audio = read('src/audio/sounds.ts');
  const required = [...audio.matchAll(/require\('\.\.\/\.\.\/assets\/sounds\/([^']+)'\)/g)].map((m) => m[1]);

  test('sounds.ts names exactly the three battle tracks and their hot renders', () => {
    for (const name of ['pixel', 'brass', 'neon']) {
      assert(required.includes(`music-${name}.m4a`), `no plain ${name}`);
      assert(required.includes(`music-${name}-hot.m4a`), `no hot ${name}`);
      assert(required.includes(`fanfare-${name}.m4a`), `no fanfare for ${name}`);
    }
    assert(required.includes('music-lobby.m4a'), 'no lobby music');
    assert(required.includes('startup.m4a'), 'no title-card sting');
    assert(required.includes('purchase.m4a'), 'no purchase sound');
    const music = required.filter((n) => n.startsWith('music-'));
    assertEqual(music.length, 7, `music files: ${music.join(', ')}`);
  });

  test('and none of the old ones', () => {
    for (const old of ['music-monkeys.m4a', 'music-sneaky.m4a', 'music-polka.m4a', 'music.m4a', 'fanfare.m4a', 'startup.wav']) {
      assert(!required.includes(old), `sounds.ts still loads ${old}`);
      assert(!existsSync(join(root, 'assets/sounds', old)), `${old} is still in assets/sounds`);
    }
  });

  test('every file it names is there, and the battle renders match in length', () => {
    for (const name of required) {
      assert(existsSync(join(root, 'assets/sounds', name)), `${name} is missing`);
    }
    for (const name of ['pixel', 'brass', 'neon']) {
      const plain = statSync(join(root, `assets/sounds/music-${name}.m4a`)).size;
      const hot = statSync(join(root, `assets/sounds/music-${name}-hot.m4a`)).size;
      // Same length, same bitrate: the files land within a few percent.
      assert(Math.abs(plain - hot) / plain < 0.05, `${name}: plain ${plain} bytes, hot ${hot} — not the same piece`);
    }
  });

  test('the generator that made them is in the repository', () => {
    for (const file of ['synth.py', 'tracks.py', 'oneshots.py', 'purchase.py', 'cheer.py', 'equip.py', 'master.sh', 'analyse.py', 'README.md']) {
      assert(existsSync(join(root, 'tools/music', file)), `tools/music/${file} is missing`);
    }
    const readme = read('tools/music/README.md');
    assert(/no samples/i.test(readme), 'the README does not say it is all generated');
    assert(/numpy/.test(readme) && /ffmpeg/.test(readme), 'the README does not say what it needs');
  });
});

suite('music · the build-up', () => {
  const audio = read('src/audio/sounds.ts');
  const body = fn(audio, 'setMusicIntensity');

  test('the hot player is seeked to the plain one\'s position before the crossfade', () => {
    // The position is read off the plain player, the hot one is seeked to
    // it, and only when that seek reports back does the fade begin.
    const position = body.indexOf('b.player.currentTime');
    const seek = body.indexOf('hotPlayer\n      .seekTo(first)');
    assert(position !== -1, 'never reads where the plain player is');
    assert(seek !== -1, 'never seeks the hot player to that position');
    assert(position < seek, 'seeks before reading the position');
    assert(/\.seekTo\(now \+ lag\)/.test(body), 'the seek does not allow for its own lag');
    assert(/\.then\(start, start\)/.test(body), 'the fade does not wait for the seek');
    const start = body.slice(body.indexOf('const start = ()'), body.indexOf('const position = ()'));
    assert(/setInterval\(step, CROSSFADE_MS \/ CROSSFADE_STEPS\)/.test(start), 'the fade timer is not started by the seek');
    assert(/hotPlayer\.volume = 0/.test(body), 'the hot player does not start silent');
  });

  test('it fades over about 1.2 seconds in about 15 steps, equal power', () => {
    assert(/export const CROSSFADE_MS = 1200;/.test(audio), 'CROSSFADE_MS');
    assert(/export const CROSSFADE_STEPS = 15;/.test(audio), 'CROSSFADE_STEPS');
    assert(/setInterval\(step, CROSSFADE_MS \/ CROSSFADE_STEPS\)/.test(body), 'the timer is not the constants');
    assert(/Math\.cos\(angle\)/.test(audio) && /Math\.sin\(angle\)/.test(audio), 'not an equal-power curve');
    assert(/plain\.remove\(\)/.test(body), 'the plain player is never let go');
  });

  test('once hot it stays hot; nothing to heat does nothing', () => {
    assert(/if \(!hot\) return;/.test(body), 'cooling down is possible');
    assert(/if \(!b \|\| b\.heat !== 'cool'\) return;/.test(body), 'going hot twice, or with no music, does something');
  });

  test('both screens ask the rule and turn it on, and a fresh battle starts cool', () => {
    for (const path of ['src/demo/DiceDemoScreen.tsx', 'src/demo/TwoPlayerScreen.tsx']) {
      const screen = read(path);
      assert(/from '\.\.\/game\/musicIntensity'/.test(screen), `${path} does not use the rule`);
      assert(/setMusicIntensity\(true\)/.test(screen), `${path} never turns the music hot`);
      assert(!/setMusicIntensity\(false\)/.test(screen), `${path} tries to cool the music`);
    }
    // Cool is in the battle's starting state, and the battle is rebuilt
    // for every fresh one.
    assert(/heat: 'cool',/.test(fn(audio, 'setMusicScene') + audio), 'a battle does not start cool');
  });
});

suite('music · the scenes', () => {
  test('the home screen and the menus are the lobby, the fight is the battle', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(/phase === 'pick'\) \{\s*setMusicScene\('lobby'\)/.test(screen), 'the menu is not the lobby');
    assert(
      /phase === 'matching' \|\|\s*phase === 'arm' \|\|\s*phase === 'go' \|\|\s*phase === 'battle'\s*\) \{\s*setMusicScene\('battle'\)/.test(screen),
      'the battle phases are not the battle',
    );
    assert(/else \{\s*setMusicScene\('none'\)/.test(screen), 'the result screens are not silent');
    assert(!/startMusic|stopMusic/.test(screen), 'the old start/stop calls are still there');
  });

  test('the two-player set-up is the lobby, its fight the battle', () => {
    const screen = read('src/demo/TwoPlayerScreen.tsx');
    assert(/phase === 'ready'\) \{\s*setMusicScene\('lobby'\)/.test(screen), 'the set-up screen is not the lobby');
    assert(/phase === 'battle'\) \{\s*setMusicScene\('battle'\)/.test(screen), 'the fight is not the battle');
    assert(!/startMusic|stopMusic/.test(screen), 'the old start/stop calls are still there');
  });

  test('the lobby has its own level, under the music slider, and waits for the home screen', () => {
    const audio = read('src/audio/sounds.ts');
    assert(/lobby: 0\.35,/.test(audio), 'MIX.lobby is not 0.35');
    assert(/music: 0\.4,/.test(audio), 'MIX.music changed');
    assert(/level \* MIX\.lobby/.test(audio), 'the lobby ignores the music slider');
    assert(/scene === 'lobby' && !titleCardUp && level > 0/.test(audio), 'the lobby plays under the title card');
    const app = read('App.tsx');
    assert(/booting: false \}, titleCardLifted\)/.test(app), 'App never says the card has lifted');
  });

  test('the fanfare is the last battle track\'s, Pixel Rush before any', () => {
    const audio = read('src/audio/sounds.ts');
    assert(/fanfareVoices\[lastTrack \?\? 'pixel'\]/.test(fn(audio, 'playFanfare')), 'the fanfare does not follow the track');
    assert(/lastTrack = track;/.test(audio), 'the last track is never remembered');
  });

  test('nothing in the music engine can throw at module scope', () => {
    const audio = read('src/audio/sounds.ts');
    const imports = [...audio.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    for (const dep of imports) {
      assert(
        dep.startsWith('.') || dep === 'expo-audio' || dep === '@react-native-async-storage/async-storage',
        `sounds.ts imports ${dep}, which was not in the binary before`,
      );
    }
  });
});

suite('music · the purchase sound', () => {
  test('buying with coins plays the purchase sound, not the fanfare', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    const start = screen.indexOf('buyWithCoins(bought.key');
    assert(start !== -1, 'no coin purchase');
    const bought = screen.slice(start, screen.indexOf("if (action.kind !== 'equip')", start));
    assert(/playPurchase\(\)/.test(bought), 'a coin purchase makes no purchase sound');
    assert(!/playFanfare\(\)/.test(bought), 'a coin purchase still plays the fanfare');
  });

  test('a real-money purchase plays it once, wherever it lands; a Restore never does', () => {
    const purchases = read('src/game/purchases.ts');
    assert(/notifyGranted\(\);/.test(fn(purchases, 'onPurchaseGranted') + purchases.slice(purchases.indexOf('async function grant('), purchases.indexOf('export type BuyResult'))), 'grant() does not announce the purchase');
    const restore = fn(purchases, 'restore');
    assert(!/notifyGranted/.test(restore), 'a Restore sounds like a purchase');
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(/onPurchaseGranted\(playPurchase\)/.test(screen), 'the screen does not play the purchase sound when one lands');
    const audio = read('src/audio/sounds.ts');
    assert(/purchase: 0\.9,/.test(audio), 'MIX.purchase is not 0.9');
    assert(/replay\(purchaseVoice\)/.test(fn(audio, 'playPurchase')), 'playPurchase does not play under the SFX slider');
  });

  test('Gold Pass levels keep the fanfare', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    assert(/if \(paid\.item\) playFanfare\(\);/.test(screen), 'a Gold level reward lost its fanfare');
  });
});

suite('music · the equip bloop', () => {
  /*
    Marc, 5 Nov 2026: "give a little bloop sound for when you have
    equipped a dice or an arena". It is equip.wav, re-made as our own,
    under the same name: playEquip() did not have to change. Putting on a
    die or a battlefield happens in ONE place — the item preview's equip
    action, for both kinds — so that is where the bloop is pinned.
  */
  test('equipping a die or a battlefield plays it, in the one place it happens', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    const equip = screen.indexOf("if (action.kind !== 'equip') return;");
    assert(equip !== -1, 'the equip action is gone');
    const block = screen.slice(equip, screen.indexOf('};', equip));
    assert(/playEquip\(\);/.test(block), 'equipping makes no sound');
    assert(/equipArena\(preview\.id\)/.test(block) && /equipSkin\(preview\.id\)/.test(block), 'the equip action no longer covers both a die and a battlefield');
    // The sound comes BEFORE the loadout changes, so it is heard as the tap.
    assert(block.indexOf('playEquip();') < block.indexOf('setLoadout('), 'the bloop waits for the loadout');
    // Nothing else puts a die or an arena on without going through here —
    // the secret reset code aside, which puts the free die back and is
    // not the player equipping anything.
    const others = [...screen.matchAll(/equip(?:Skin|Arena)\(/g)].length;
    assertEqual(others, 3, 'a new place equips something; does it play the bloop?');
  });

  test('equip.wav is the new bloop, in the old format, and its generator is here', () => {
    const bytes = statSync(join(root, 'assets/sounds/equip.wav')).size;
    assert(bytes !== 18566, 'assets/sounds/equip.wav is still the old rising fifth');
    // Mono 16-bit at 22.05 kHz, 0.42 s: 44 bytes of header plus the samples.
    assert(Math.abs(bytes - (44 + 0.42 * 22050 * 2)) < 200, `equip.wav is ${bytes} bytes, not the 0.42 s mono 22.05 kHz file the old one was`);
    const header = readFileSync(join(root, 'assets/sounds/equip.wav')).subarray(0, 36);
    assertEqual(header.toString('ascii', 0, 4), 'RIFF', 'not a WAV');
    assertEqual(header.readUInt16LE(22), 1, 'not mono');
    assertEqual(header.readUInt32LE(24), 22050, 'not 22.05 kHz');
    assertEqual(header.readUInt16LE(34), 16, 'not 16-bit');
    assert(existsSync(join(root, 'tools/music/equip.py')), 'tools/music/equip.py is missing');
    const audio = read('src/audio/sounds.ts');
    assert(/replay\(equipVoice\)/.test(fn(audio, 'playEquip')), 'playEquip changed');
  });
});

suite('music · the credits', () => {
  /*
    Marc, 5 Nov 2026: "take away the music that we had before and take
    away the credits for it so we don't have to give credits to anyone
    and all the music in the game is just ours." So the cheer went too —
    it was the one other CC-BY sound — and nothing left needs a credit.
  */
  test('CREDITS.md credits the music and the cheer as our own and drops the old rows', () => {
    const credits = read('assets/sounds/CREDITS.md');
    for (const gone of ['Kevin MacLeod', 'incompetech', 'OwlishMedia', 'Zane Little', 'Hyper-Ultra-Fanfare', 'Happy Clappy', 'Gregor Quendel', 'attribution required']) {
      assert(!credits.includes(gone), `CREDITS.md still has ${gone}`);
    }
    assert(/Composed and synthesised for this game by Paper Ship Studio, `tools\/music` — no samples/.test(credits), 'no own-work row');
    for (const file of ['music-pixel.m4a', 'music-lobby.m4a', 'fanfare-neon.m4a', 'startup.m4a', 'purchase.m4a', 'cheer.m4a']) {
      assert(credits.includes(file), `CREDITS.md does not list ${file}`);
    }
    assert(credits.includes('Kenney'), 'the Kenney rows are gone — they are the record of where the dice came from');
    assert(/nothing in the game requires attribution/i.test(credits), 'CREDITS.md does not say nothing needs a credit');
  });

  test('the cheer is the new one, and its generator is here', () => {
    const bytes = statSync(join(root, 'assets/sounds/cheer.m4a')).size;
    assert(bytes !== 19863, 'assets/sounds/cheer.m4a is still the old recording');
    assert(existsSync(join(root, 'tools/music/cheer.py')), 'tools/music/cheer.py is missing');
  });

  test('no file the player or the store sees still credits the old music or the old cheer', () => {
    const gone = /Kevin MacLeod|incompetech|OwlishMedia|Zane Little|Hyper-Ultra-Fanfare|Gregor Quendel/;
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(root, dir))) {
        if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
        const path = join(dir, entry);
        if (statSync(join(root, path)).isDirectory()) walk(path);
        else if (/\.(ts|tsx|md|txt|json)$/.test(entry) && gone.test(read(path))) hits.push(path);
      }
    };
    for (const dir of ['src', 'hq/src', 'store', 'docs', 'assets']) {
      if (existsSync(join(root, dir))) walk(dir);
    }
    assertEqual(hits.join(', '), '', 'old music credits remain');
  });
});
