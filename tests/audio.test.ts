import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { store } from './storageMock';
import {
  AudioLevelKey,
  clampVolume,
  effectiveVolume,
  getAudioSettings,
  isAudible,
  loadAudioSettings,
  normalizeAudioSettings,
  resetAudioSettingsForTests,
  setAudioVolume,
  subscribeAudioSettings,
  VOLUME_STEP,
} from '../src/audio/settings';
import {
  fillPercent,
  volumeFromTouch,
  volumeIcon,
  volumeLabel,
  knobLeft,
} from '../src/audio/slider';
import { assert, assertClose, assertEqual, suite, test } from './harness';

/**
 * Volume. A slider is only trustworthy if its ends are absolute: all the
 * way down must be silence (a child told to turn it off has turned it off)
 * and all the way up must be the game at full volume. Everything here
 * guards one of those two ends, or the trip through storage between them.
 */
const KEY = 'dice-battles:audio-settings';
const CHANNELS = ['sfx', 'music', 'voice'] as const;

suite('audio · levels', () => {
  test('a slider cannot be pushed past silence or past full', () => {
    assertEqual(clampVolume(-3), 0, 'below the left end');
    assertEqual(clampVolume(0), 0, 'the left end itself');
    assertEqual(clampVolume(1), 1, 'the right end itself');
    assertEqual(clampVolume(4.2), 1, 'past the right end');
    assertEqual(clampVolume(Number.NaN), 0, 'a nonsense value');
  });

  test('levels land on clean steps rather than long decimals', () => {
    for (const raw of [0.123, 0.5001, 0.98, 0.3333]) {
      const value = clampVolume(raw);
      const steps = value / VOLUME_STEP;
      assertClose(steps, Math.round(steps), 1e-9, `${raw} is off-step`);
      assertEqual(
        value,
        Math.round(value * 100) / 100,
        `${raw} stored with float noise`,
      );
    }
  });

  test('the master slider scales the others, and zero means zero', () => {
    resetAudioSettingsForTests({ master: 0.5, sfx: 1, music: 0.5, voice: 0 });
    assertClose(effectiveVolume('sfx'), 0.5, 1e-9, 'master should halve sfx');
    assertClose(effectiveVolume('music'), 0.25, 1e-9, 'master should halve music');
    assertEqual(effectiveVolume('voice'), 0, 'a channel at zero is silent');
    assert(isAudible('sfx'), 'sfx should be audible');
    assert(!isAudible('voice'), 'a channel at zero should not be audible');

    resetAudioSettingsForTests({ master: 0, sfx: 1, music: 1, voice: 1 });
    for (const channel of CHANNELS) {
      assertEqual(effectiveVolume(channel), 0, `master at zero left ${channel} on`);
      assert(!isAudible(channel), `${channel} still audible with master off`);
    }
  });

  test('defaults leave the game sounding exactly as it did before sliders', () => {
    resetAudioSettingsForTests();
    const settings = getAudioSettings();
    for (const key of ['master', ...CHANNELS] as AudioLevelKey[]) {
      assertEqual(settings[key], 1, `${key} does not default to full`);
    }
  });
});

suite('audio · remembering', () => {
  test('a level set today is the level tomorrow', async () => {
    resetAudioSettingsForTests();
    setAudioVolume('music', 0.35);
    setAudioVolume('master', 0.6);
    const reloaded = await loadAudioSettings();
    assertEqual(reloaded.music, 0.35, 'music level was forgotten');
    assertEqual(reloaded.master, 0.6, 'master level was forgotten');
    assertEqual(reloaded.sfx, 1, 'an untouched slider moved on its own');
  });

  test('settings saved before sliders existed keep their on/off choice', () => {
    // Up to v1.8.0 these were booleans. Someone who had muted the
    // announcer must not be shouted at by the update.
    const legacy = normalizeAudioSettings({ sfx: true, music: false, voice: true });
    assertEqual(legacy.music, 0, 'a switched-off channel came back loud');
    assertEqual(legacy.sfx, 1, 'a switched-on channel came back quiet');
    assertEqual(legacy.voice, 1, 'a switched-on channel came back quiet');
    assertEqual(legacy.master, 1, 'master should default to full');
  });

  test('an old saved file loads through storage, not just in theory', async () => {
    store.set(KEY, JSON.stringify({ sfx: true, music: false, voice: false }));
    const loaded = await loadAudioSettings();
    assertEqual(loaded.music, 0, 'muted music came back on');
    assertEqual(loaded.voice, 0, 'muted announcer came back on');
    assertEqual(loaded.sfx, 1, 'sound effects came back quiet');
  });

  test('junk in storage falls back to full volume instead of silence', async () => {
    // Failing quiet is worse than failing loud here: a game that lost its
    // settings file and came back mute reads as broken.
    store.set(KEY, 'not json at all');
    const survived = await loadAudioSettings();
    for (const key of ['master', ...CHANNELS] as AudioLevelKey[]) {
      assertEqual(survived[key], 1, `${key} after corrupt storage`);
    }

    store.set(KEY, JSON.stringify({ sfx: 'loud', music: 99, voice: null }));
    const cleaned = await loadAudioSettings();
    assertEqual(cleaned.sfx, 1, 'a nonsense level should fall back to full');
    assertEqual(cleaned.music, 1, 'an out-of-range level should clamp to full');
    assertEqual(cleaned.voice, 1, 'a missing level should default to full');
    store.delete(KEY);
  });
});

suite('audio · following the slider live', () => {
  test('moving a slider tells the music loop at once', () => {
    resetAudioSettingsForTests();
    let told = 0;
    const stop = subscribeAudioSettings(() => {
      told += 1;
    });
    setAudioVolume('music', 0.5);
    setAudioVolume('master', 0.5);
    assertEqual(told, 2, 'the music loop was not told a slider moved');
    stop();
    setAudioVolume('music', 0.2);
    assertEqual(told, 2, 'a cancelled listener is still being called');
  });

  test('one broken listener cannot break the settings screen', () => {
    resetAudioSettingsForTests();
    subscribeAudioSettings(() => {
      throw new Error('audio player exploded');
    });
    let reached = false;
    subscribeAudioSettings(() => {
      reached = true;
    });
    const settings = setAudioVolume('sfx', 0.4);
    assertEqual(settings.sfx, 0.4, 'the level was lost');
    assert(reached, 'a failing listener stopped the others');
    resetAudioSettingsForTests();
  });
});

suite('audio · the slider itself', () => {
  test('the far left is silence and the far right is full', () => {
    assertEqual(volumeFromTouch(0, 240), 0, 'the left end is not silent');
    assertEqual(volumeFromTouch(240, 240), 1, 'the right end is not full');
    // Fingers overshoot the bar; that must not wrap around.
    assertEqual(volumeFromTouch(-40, 240), 0, 'dragging off the left end');
    assertEqual(volumeFromTouch(900, 240), 1, 'dragging off the right end');
  });

  test('the middle of the bar is half volume', () => {
    assertClose(volumeFromTouch(120, 240), 0.5, 1e-9, 'the midpoint');
    assertClose(volumeFromTouch(60, 240), 0.25, 1e-9, 'a quarter along');
  });

  test('a bar not measured yet cannot be dragged to a random level', () => {
    // onLayout has not run on the first frame; a divide by zero here would
    // set the volume to whatever NaN clamps to.
    assertEqual(volumeFromTouch(50, 0), 0, 'unmeasured bar');
    assertEqual(volumeFromTouch(Number.NaN, 240), 0, 'a nonsense touch');
  });

  test('the bar is drawn where the value actually is', () => {
    assertEqual(fillPercent(0), '0%', 'silence should draw an empty bar');
    assertEqual(fillPercent(0.5), '50%', 'half should draw a half bar');
    assertEqual(fillPercent(1), '100%', 'full should draw a full bar');
  });

  test('silence says so in words, not just a small number', () => {
    assertEqual(volumeLabel(0), 'OFF', 'zero should read OFF');
    assertEqual(volumeLabel(1), '100%', 'full should read 100%');
    assertEqual(volumeLabel(0.35), '35%', 'a middling level');
    // The icon has to be readable by a player too young for percentages.
    assertEqual(volumeIcon(0), '🔇', 'muted icon');
    const icons = [0, 0.2, 0.5, 1].map(volumeIcon);
    assertEqual(new Set(icons).size, 4, 'every step should look different');
  });
});

suite('audio · wiring', () => {
  const read = (path: string) =>
    readFileSync(join(__dirname, '..', path), 'utf8');

  test('nothing plays without checking the sliders first', () => {
    for (const path of ['src/audio/sounds.ts', 'src/audio/announcer.ts']) {
      const source = read(path);
      assert(
        source.includes('effectiveVolume'),
        `${path} plays sound without reading the volume sliders`,
      );
      assert(
        !source.includes('getAudioSettings()'),
        `${path} still gates sound on the old on/off switches`,
      );
    }
  });

  test('every channel with a sound has a slider on the settings screen', () => {
    const screen = read('src/demo/DiceDemoScreen.tsx');
    for (const key of ['master', ...CHANNELS]) {
      assert(
        new RegExp(`\\['${key}',`).test(screen),
        `there is no ${key} slider in Settings`,
      );
    }
    assert(
      screen.includes('setAudioVolume'),
      'the settings screen does not save the levels it shows',
    );
  });

  test('the slider is drawn in plain React Native, not a native package', () => {
    // Native code cannot reach players over the air — it would sit unused
    // until they installed a whole new build from the App Store.
    const slider = read('src/demo/VolumeSlider.tsx');
    assert(
      !/from '(?!react|\.\.\/)/.test(slider.replace(/from 'react-native'/g, '')),
      'the slider pulls in a package that is not React Native',
    );
    assert(
      slider.includes('PanResponder'),
      'the slider should drive itself with PanResponder',
    );
  });
});

suite('audio · slider knob', () => {
  const KNOB = 22;

  test('the knob never hangs off either end of the track', () => {
    // It used to be placed by percentage with a negative margin, so it sat
    // half outside the panel at 0% and at 100% — David saw it as the
    // slider going off the menu.
    for (const width of [120, 200, 260, 320]) {
      for (let v = 0; v <= 1.0001; v += 0.05) {
        const left = knobLeft(v, width, KNOB);
        assert(left >= 0, `knob left ${left} is off the left end at ${v}`);
        assert(
          left + KNOB <= width + 0.0001,
          `knob right ${left + KNOB} passes the track width ${width} at ${v}`,
        );
      }
    }
  });

  test('the ends of the track really are the ends of the range', () => {
    assertEqual(knobLeft(0, 200, KNOB), 0, 'silence should sit flush left');
    assertEqual(knobLeft(1, 200, KNOB), 178, 'full should sit flush right');
  });

  test('the knob moves in step with the value', () => {
    let previous = -1;
    for (let v = 0; v <= 1.0001; v += 0.1) {
      const left = knobLeft(v, 200, KNOB);
      assert(left > previous, `knob went backwards at ${v}`);
      previous = left;
    }
  });

  test('a track with no width yet cannot produce a broken position', () => {
    assertEqual(knobLeft(0.5, 0, KNOB), 0, 'zero width');
    assertEqual(knobLeft(0.5, Number.NaN, KNOB), 0, 'unmeasured width');
    // A track narrower than the knob has nowhere to travel, not a negative.
    assertEqual(knobLeft(1, 10, KNOB), 0, 'track narrower than the knob');
  });
});
