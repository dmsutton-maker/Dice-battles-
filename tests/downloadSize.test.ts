import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assert, note, suite, test } from './harness';

/*
  David, 23 Oct 2026: "Make the game download smaller."

  The sound was the part we could shrink. React Native, Hermes and the
  ad SDK are a fixed ~25 MB of every build; the music alone was 6 MB of
  the 14 MB the game itself adds, at near-CD stereo bitrates nobody hears
  through a phone speaker, and sixteen announcer words were uncompressed
  WAV. Re-encoded (mono 64 kbps music, AAC for the voice, fanfare and
  cheer, loudness matched to the originals) it came to 3 MB less.

  WAV is still right for the dice clacks, throws and taps: they are tiny
  and play the instant a die lands, which AAC's short start-up delay
  would smear. These limits keep anything long from coming back as WAV,
  and the music from creeping back up.
*/
const root = join(__dirname, '..');

function filesIn(dir: string): { name: string; bytes: number }[] {
  return readdirSync(join(root, dir))
    .filter((n) => /\.(wav|m4a|mp3|caf)$/.test(n))
    .map((n) => ({ name: `${dir}/${n}`, bytes: statSync(join(root, dir, n)).size }));
}

const sounds = [...filesIn('assets/sounds'), ...filesIn('assets/voice')];

suite('download size · the sound stays small', () => {
  test('a WAV is only ever a short, instant sound effect', () => {
    for (const f of sounds) {
      if (f.name.endsWith('.wav')) assert(f.bytes <= 70_000, `${f.name} is ${f.bytes} bytes of WAV; encode it as .m4a`);
    }
  });

  test('all the sound together stays under 4.5 MB', () => {
    const total = sounds.reduce((sum, f) => sum + f.bytes, 0);
    note(`all sound: ${(total / 1e6).toFixed(2)} MB`);
    assert(total <= 4_500_000, `the sound is ${(total / 1e6).toFixed(2)} MB; it was 7.4 MB before 23 Oct 2026`);
  });

  test('the music is encoded at about 64 kbps, not CD quality', () => {
    // 64 kbps is 8 KB a second; two and a half minutes of music is ~1.2 MB.
    for (const f of sounds.filter((s) => s.name.includes('/music'))) {
      assert(f.bytes <= 1_800_000, `${f.name} is ${(f.bytes / 1e6).toFixed(2)} MB`);
    }
  });
});
