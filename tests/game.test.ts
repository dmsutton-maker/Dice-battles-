import { AI_DIFFICULTIES, AI_ROSTER, pickOpponent, rollAiDice } from '../src/game/ai';
import { readFileSync } from 'node:fs';
import { tierItem, TIERS_WITHOUT_A_PICTURE } from '../src/game/tierItem';
import { OBSTACLES_BY_DIFFICULTY } from '../src/game/obstacles';
import {
  DIE_FACE_COLORS,
  inkOn,
  PRISONER_COLORS,
  pastelOf,
} from '../src/game/colors';
import {
  laneColors,
  laneOf,
  opponentColors,
  makeUnits,
  MODE_ORDER,
  MODES,
  ModeId,
} from '../src/game/modes';
import {
  TIERS,
  TROPHY_STAKES,
  tierLabel,
  UnlockId,
} from '../src/game/progress';
import {
  JAIL_SLOTS,
  RETREAT_SLOTS,
  slotFor,
  WALL_SLOTS,
} from '../src/game/stations';
import { assert, assertEqual, note, suite, test } from './harness';
import { averageOf } from '../src/game/rewards';

/** Rules, progression and palette invariants — pure logic, no physics. */

/** HSL readings, so the pastel tests talk about shade rather than hexes. */
function hslOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g
        ? ((b - r) / d + 2) / 6
        : ((r - g) / d + 4) / 6;
  return [h, s, l];
}
const hueOf = (hex: string) => hslOf(hex)[0];
const saturationOf = (hex: string) => hslOf(hex)[1];
const lightnessOf = (hex: string) => hslOf(hex)[2];

/** WCAG contrast ratio between two solid colours. */
function contrast(a: string, b: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return (
      0.2126 * channel((n >> 16) & 255) +
      0.7152 * channel((n >> 8) & 255) +
      0.0722 * channel(n & 255)
    );
  };
  const l1 = lum(a) + 0.05;
  const l2 = lum(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

suite('game · colors', () => {
  test('six prisoner colors, one per die face', () => {
    assertEqual(PRISONER_COLORS.length, 6, 'prisoner color count');
    assertEqual(DIE_FACE_COLORS.length, 6, 'die face count');
    const faceIds = new Set(DIE_FACE_COLORS.map((c) => c.id));
    assertEqual(faceIds.size, 6, 'die faces must all differ');
    PRISONER_COLORS.forEach((c) =>
      assert(faceIds.has(c.id), `${c.id} has no die face`),
    );
  });

  test('colors stay far enough apart to tell apart at a glance', () => {
    // Two dice matching is the whole game, so any pair a player could
    // confuse is a gameplay bug, not a style choice. Compared in CIELAB,
    // which tracks perceived difference far better than RGB.
    const toLab = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      const [r, g, b] = srgb;
      const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.9505;
      const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.089;
      const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
    };
    for (let i = 0; i < PRISONER_COLORS.length; i++) {
      for (let j = i + 1; j < PRISONER_COLORS.length; j++) {
        const a = toLab(PRISONER_COLORS[i].hex);
        const b = toLab(PRISONER_COLORS[j].hex);
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        assert(
          distance > 25,
          `${PRISONER_COLORS[i].label} and ${PRISONER_COLORS[j].label} look too alike (ΔLab ${distance.toFixed(1)})`,
        );
      }
    }
  });

  test('every color has a kid-readable label', () => {
    PRISONER_COLORS.forEach((c) => {
      assert(c.label.length > 0, `${c.id} has no label`);
      assert(/^#[0-9a-f]{6}$/i.test(c.hex), `${c.id} has a malformed hex`);
    });
  });
});

suite('game · modes', () => {
  const modes: ModeId[] = MODE_ORDER;

  test('every mode is listed once with rules kids can read', () => {
    assertEqual(new Set(modes).size, modes.length, 'mode order has duplicates');
    assertEqual(modes.length, Object.keys(MODES).length, 'mode count mismatch');
    modes.forEach((id) => {
      assert(MODES[id].rules.length > 0, `${id} has no rules text`);
      assert(MODES[id].name.length > 0, `${id} has no name`);
    });
  });

  test('each mode starts everyone in jail with valid slots', () => {
    for (const mode of modes) {
      const [player, ai] = [PRISONER_COLORS[0], PRISONER_COLORS[1]];
      const units = makeUnits(mode, PRISONER_COLORS, player, ai);
      assert(units.length > 0, `${mode} produced no prisoners`);
      units.forEach((unit) => {
        assertEqual(unit.station.kind, 'jail', `${mode}: everyone starts in jail`);
        assert(
          unit.jailIndex >= 0 && unit.jailIndex < JAIL_SLOTS.length,
          `${mode}: jail index ${unit.jailIndex} has no cell`,
        );
        assert(
          PRISONER_COLORS.some((c) => c.id === unit.colorId),
          `${mode}: unit has unknown color ${unit.colorId}`,
        );
      });
      assertEqual(
        new Set(units.map((u) => u.key)).size,
        units.length,
        `${mode}: duplicate unit keys`,
      );
    }
  });

  test('Color War splits the two fighters evenly', () => {
    const [player, ai] = [PRISONER_COLORS[0], PRISONER_COLORS[1]];
    const units = makeUnits('colorwar', PRISONER_COLORS, player, ai);
    const mine = units.filter((u) => u.colorId === player.id).length;
    const theirs = units.filter((u) => u.colorId === ai.id).length;
    assertEqual(mine, 3, 'player fighters');
    assertEqual(theirs, 3, 'opponent fighters');
  });

  test('every figure has a lane of its own, in every mode', () => {
    /*
      The property that replaced hole-filling, and the reason AJ's bug
      (24 Aug 2026, "the soldiers sometimes in ultimate go to the same
      spot") cannot come back: a figure is only ever sent to its own
      lane, and no two figures share one. Placing by count or by first
      free slot both needed the rest of the board to be right; this
      needs nothing at all.
    */
    for (const mode of MODE_ORDER) {
      const units = makeUnits(
        mode,
        PRISONER_COLORS,
        PRISONER_COLORS[0],
        PRISONER_COLORS[1],
      );
      const lanes = units.map(laneOf);
      assertEqual(
        new Set(lanes).size,
        units.length,
        `${mode}: two figures are sent to the same spot (${lanes.join(',')})`,
      );
      assert(
        lanes.every((l) => l >= 0 && l < RETREAT_SLOTS.length),
        `${mode}: a figure has no pad to stand on (${lanes.join(',')})`,
      );
    }
  });

  test('the pad a figure lands on is painted its own colour', () => {
    /*
      DAVID, 20 Sep 2026: "make each prisoner when you free them go to
      the platform of their respective color."

      Two separate pieces of code have to agree for that to be true —
      the board, which sends a figure to laneOf(unit), and the arena,
      which paints pad i with laneColors()[i]. Asserted together here
      because either one alone is fine and the pair is what a player
      sees.
    */
    for (const mode of MODE_ORDER) {
      const units = makeUnits(
        mode,
        PRISONER_COLORS,
        PRISONER_COLORS[0],
        PRISONER_COLORS[1],
      );
      const pads = laneColors(units, RETREAT_SLOTS.length);
      for (const u of units) {
        assertEqual(
          pads[laneOf(u)],
          pastelOf(u.hex),
          `${mode}: a ${u.colorId} prisoner walks onto a ${pads[laneOf(u)]} pad`,
        );
      }
      assert(
        pads.every((c) => c !== null),
        `${mode}: a pad was left unpainted (${pads.join(',')})`,
      );
    }
  });

  test('a pad is PALE, not the colour it matches', () => {
    /*
      David, 25 Sep 2026: "make the platforms the much lighter more
      pastel colors from before."

      The pads were the exact palette hexes from 20 Sep, which shouted
      over the battlefield and competed with the FIGURES standing on
      them — the same six colours, and the thing you are meant to be
      looking at. Asserted as a relationship rather than against six
      pinned strings, so retuning the tint does not mean editing a table
      of hexes that says nothing about why.
    */
    const units = makeUnits('classic', PRISONER_COLORS, null, null);
    const pads = laneColors(units, RETREAT_SLOTS.length);
    for (const u of units) {
      const pad = pads[laneOf(u)]!;
      assert(pad !== u.hex, `the ${u.colorId} pad is still the full ${u.hex}`);
      assert(
        lightnessOf(pad) > lightnessOf(u.hex),
        `the ${u.colorId} pad (${pad}) is not lighter than the prisoner on it`,
      );
      /*
        The absolute floor is the one that matters, and a DELTA is not a
        substitute for it: Purple already sits at 73% lightness, so a
        "much lighter than before" test written as a step would pass for
        five colours and fail for the one that was nearly there. Every
        pad has to be pale, wherever it started.
      */
      assert(
        lightnessOf(pad) > 0.8,
        `the ${u.colorId} pad (${pad}) is not pale enough to read as pastel`,
      );
    }
  });

  test('a pale pad is still recognisably its own colour', () => {
    /*
      The half that makes the pads worth having at all. Lifting
      lightness without keeping the hue would give six pale squares that
      no longer say which prisoner belongs on them — which is the whole
      feature, gone, in a change that looked like a paint job.
    */
    for (const c of PRISONER_COLORS) {
      const before = hueOf(c.hex);
      const after = hueOf(pastelOf(c.hex));
      const drift = Math.min(Math.abs(after - before), 1 - Math.abs(after - before));
      assert(drift < 0.01, `${c.label} changed hue when it was lightened`);
    }
  });

  test('a colour that starts out muted does not come back grey', () => {
    /*
      TESTED WITH A MUTED COLOUR DIRECTLY, and that is the point of the
      test rather than an accident of how it is written.

      Running the floor over the six colours the game has proves nothing
      about it: the least saturated of them is Green at 60%, above the
      floor, so removing the floor entirely leaves all six unchanged and
      a test written over the palette passes either way. Which is
      exactly what happened — this test said nothing until it was given
      something muted to say it about.

      What it protects: this function is handed whatever colour a round
      is played with, and lifting lightness alone turns a dull one into
      an off-white smudge.
    */
    const muted = '#8a7a6e'; // a dull warm grey-brown, saturation ~12%
    assert(
      saturationOf(pastelOf(muted)) > 0.4,
      `a muted colour came back as a grey smudge (${pastelOf(muted)})`,
    );
    // And the six the game actually uses stay lively too.
    for (const c of PRISONER_COLORS) {
      assert(
        saturationOf(pastelOf(c.hex)) > 0.5,
        `pale ${c.label} (${pastelOf(c.hex)}) came back washed out`,
      );
    }
  });

  test('anything that is not a plain hex is left alone', () => {
    // A pad that fails to draw is worse than one in the wrong shade.
    assertEqual(pastelOf('rebeccapurple'), 'rebeccapurple', 'a named colour was mangled');
    assertEqual(pastelOf('#fff'), '#fff', 'a short hex was mangled');
    assertEqual(pastelOf(''), '', 'an empty string threw or changed');
  });

  test('Color War paints your half of the row your colour', () => {
    /*
      "Make the platforms in color war match the colors of whatever the
      colors being used are." Only two colours are in play and they are
      redrawn every round, so the row is your three on the left and your
      opponent's three on the right — not six.
    */
    const [me, them] = [PRISONER_COLORS[2], PRISONER_COLORS[4]];
    const pads = laneColors(
      makeUnits('colorwar', PRISONER_COLORS, me, them),
      RETREAT_SLOTS.length,
    );
    const mine = pastelOf(me.hex);
    const theirs = pastelOf(them.hex);
    assertEqual(pads.slice(0, 3).join(','), [mine, mine, mine].join(','),
      'the left three pads are not your colour');
    assertEqual(pads.slice(3).join(','), [theirs, theirs, theirs].join(','),
      'the right three pads are not your opponent’s colour');
  });
});

suite('game · opponents', () => {
  test('every opponent rolls at the same human pace', () => {
    // Difficulty used to be the opponent's roll speed. That cannot survive
    // online play — a real opponent rolls at whatever pace they roll — so
    // difficulty moved to the battlefield and the pace was equalised.
    const intervals = Object.values(AI_DIFFICULTIES).map((d) => d.rollIntervalMs);
    assertEqual(
      new Set(intervals).size,
      1,
      'difficulties should no longer differ by opponent speed',
    );
    // A human roll cycle is roughly 1.5-2s including the settle, so a
    // faster opponent would be unbeatable rather than challenging.
    assert(intervals[0] >= 1500, 'the opponent rolls faster than a human can');
  });

  test('difficulty comes from the battlefield instead', () => {
    // With speed equalised, the hazards are the only thing left to make
    // Hard hard — so each step up must actually add one.
    const count = (d: 'easy' | 'medium' | 'hard') =>
      Object.values(OBSTACLES_BY_DIFFICULTY[d]).filter(Boolean).length;
    assert(
      count('easy') < count('medium') && count('medium') < count('hard'),
      'each difficulty should add a hazard',
    );
    assertEqual(count('easy'), 0, 'Easy should be a clear courtyard');
  });

  test('the roster is unique and never repeats an opponent back to back', () => {
    assertEqual(
      new Set(AI_ROSTER.map((o) => o.name)).size,
      AI_ROSTER.length,
      'duplicate opponent names',
    );
    AI_ROSTER.forEach((o) => {
      assert(o.short.length > 0 && o.emoji.length > 0, `${o.name} is missing a tag`);
    });
    let previous = AI_ROSTER[0];
    for (let i = 0; i < 200; i++) {
      const next = pickOpponent(previous);
      assert(next.name !== previous.name, 'drew the same opponent twice running');
      previous = next;
    }
  });

  test('AI dice are fair', () => {
    // The AI must not cheat: each color equally likely, ~1/6 match rate.
    const counts = new Map<string, number>();
    let matches = 0;
    const rolls = 60000;
    for (let i = 0; i < rolls; i++) {
      const [a, b] = rollAiDice();
      counts.set(a.id, (counts.get(a.id) ?? 0) + 1);
      counts.set(b.id, (counts.get(b.id) ?? 0) + 1);
      if (a.id === b.id) matches++;
    }
    const expected = (rolls * 2) / 6;
    counts.forEach((count, id) => {
      const drift = Math.abs(count - expected) / expected;
      assert(drift < 0.05, `${id} came up ${(drift * 100).toFixed(1)}% off fair`);
    });
    const matchRate = matches / rolls;
    assert(
      Math.abs(matchRate - 1 / 6) < 0.01,
      `match rate ${matchRate.toFixed(3)} is not 1-in-6`,
    );
  });
});

suite('game · progression', () => {
  test('the trophy ladder climbs and every tier is reachable', () => {
    for (let i = 1; i < TIERS.length; i++) {
      // >= rather than >: the arena and the dice you START with both sit at
      // zero, so the ladder can show where you began.
      assert(
        TIERS[i].at >= TIERS[i - 1].at,
        `tier ${TIERS[i].id} does not come after ${TIERS[i - 1].id}`,
      );
    }
    assertEqual(TIERS[0].at, 0, 'first tier must be free');
    assert(
      TIERS.filter((t) => t.at === 0).length <= 2,
      'only the starting arena and dice should be free',
    );
    assertEqual(
      new Set(TIERS.map((t) => t.id)).size,
      TIERS.length,
      'duplicate unlock ids',
    );
  });

  test('harder battles are worth more and risk more', () => {
    const { easy, medium, hard } = TROPHY_STAKES;
    assert(
      averageOf(easy.win) < averageOf(medium.win) &&
        averageOf(medium.win) < averageOf(hard.win),
      'wins should scale',
    );
    assert(
      averageOf(easy.loss) < averageOf(medium.loss) &&
        averageOf(medium.loss) < averageOf(hard.loss),
      'losses should scale',
    );
    (['easy', 'medium', 'hard'] as const).forEach((d) => {
      // Compared at the worst case: the SMALLEST possible win must still
      // beat the BIGGEST possible loss, or a good game can cost you rank.
      assert(
        TROPHY_STAKES[d].win.min > TROPHY_STAKES[d].loss.max,
        `${d} can punish losing more than it rewards winning`,
      );
    });
  });

  test('every tier shows its real name, locked or not', () => {
    // There used to be a "❓ Mystery Arena" that hid Space Station until it
    // was earned. David asked for the name all the way through: a reward
    // you cannot see is not a reward you can want.
    TIERS.forEach((tier) => {
      const locked = tierLabel(tier, Math.max(0, tier.at - 1));
      const earned = tierLabel(tier, tier.at);
      assertEqual(locked.name, tier.name, `${tier.id} hides its name while locked`);
      assertEqual(earned.name, tier.name, `${tier.id} renames itself once earned`);
      assertEqual(locked.emoji, tier.emoji, `${tier.id} hides its emoji while locked`);
    });
  });
});

suite('game · stations', () => {
  test('there are six places to stand at every station', () => {
    assertEqual(JAIL_SLOTS.length, 6, 'jail cells');
    assertEqual(RETREAT_SLOTS.length, 6, 'retreat spots');
    assertEqual(WALL_SLOTS.length, 6, 'battlement spots');
  });

  test('slots never overlap, so figures cannot stand inside each other', () => {
    for (const [name, slots] of [
      ['jail', JAIL_SLOTS],
      ['retreat', RETREAT_SLOTS],
      ['wall', WALL_SLOTS],
    ] as const) {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const d = Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z);
          assert(d > 0.55, `${name} spots ${i} and ${j} are only ${d.toFixed(2)} apart`);
        }
      }
    }
  });

  test('an out-of-range station index still resolves to a spot', () => {
    // Defensive: a mode asking for a seventh spot must not crash the scene.
    const slot = slotFor({ kind: 'retreat', index: 99 });
    assert(slot !== undefined, 'overflowing station index returned nothing');
  });

  test('jail sits behind the far wall and the retreat on the player side', () => {
    JAIL_SLOTS.forEach((s) => assert(s.z < 0, 'jail should be past the far wall'));
    RETREAT_SLOTS.forEach((s) => assert(s.z > 0, 'retreat should be on our side'));
  });
});

suite('game · color war sides', () => {
  test('your three prisoners hold the left half of the jail', () => {
    const [mine, theirs] = [PRISONER_COLORS[0], PRISONER_COLORS[1]];
    const units = makeUnits('colorwar', PRISONER_COLORS, mine, theirs);
    assertEqual(units.length, 6, 'color war should field six figures');

    const left = units.filter((u) => u.jailIndex < 3);
    const right = units.filter((u) => u.jailIndex >= 3);
    assert(
      left.every((u) => u.colorId === mine.id),
      'the left half of the jail is not all yours',
    );
    assert(
      right.every((u) => u.colorId === theirs.id),
      'the right half of the jail is not all your opponent\'s',
    );
  });

  test('every figure still has its own jail cell', () => {
    const units = makeUnits(
      'colorwar',
      PRISONER_COLORS,
      PRISONER_COLORS[2],
      PRISONER_COLORS[4],
    );
    const cells = units.map((u) => u.jailIndex).sort((a, b) => a - b);
    assertEqual(cells.join(','), '0,1,2,3,4,5', 'two figures share a cell');
    assertEqual(
      new Set(units.map((u) => u.key)).size,
      units.length,
      'two figures share a key',
    );
  });
});

suite('game · the cross on a colour your opponent took', () => {
  /*
    David, 25 Sep 2026: "put a little x over the color when your opponent
    gets it in game."

    The mark itself is two bars in a View and there is nothing to test
    about that. WHICH colours wear one is a different question with a
    different answer in every mode, and the wrong answer puts a cross on
    a prisoner still sitting in the jail — which tells a player they have
    lost something they have not.
  */
  const fresh = () => makeUnits('skirmish', PRISONER_COLORS, null, null);

  test('Color Rush and Ultimate read the opponent’s own list', () => {
    const units = fresh();
    assertEqual(
      opponentColors('classic', units, ['red', 'blue'])?.join(','),
      'red,blue',
      'the opponent’s colours were not reported',
    );
    assertEqual(
      opponentColors('ultimate', units, [])?.length,
      0,
      'a fresh board already has colours crossed off',
    );
  });

  test('a colour sent back in Ultimate loses its cross again', () => {
    // The mode's whole trick: an exchange takes one back off the
    // opponent, and a cross that stayed would say otherwise.
    const units = fresh();
    const before = opponentColors('ultimate', units, ['red', 'blue'])!;
    const after = opponentColors('ultimate', units, ['red'])!;
    assertEqual(before.length, 2, 'setup');
    assertEqual(after.join(','), 'red', 'the sent-back colour kept its cross');
  });

  test('Skirmish reads the battlement, not a second list', () => {
    /*
      ONE shared jail, so a colour they took is one taken off you — and
      the figures on the far wall are what the player can actually see.
      Counting anything else could cross off a colour still in the jail.
    */
    const units = fresh().map((u, i) =>
      i < 2 ? { ...u, station: { kind: 'wall' as const, index: i } } : u,
    );
    const taken = opponentColors('skirmish', units, [])!;
    assertEqual(
      taken.join(','),
      `${PRISONER_COLORS[0].id},${PRISONER_COLORS[1].id}`,
      'the crosses do not match the figures on the wall',
    );
    // A prisoner the PLAYER rescued is not the opponent's.
    const mine = fresh().map((u, i) =>
      i < 2 ? { ...u, station: { kind: 'retreat' as const, index: i } } : u,
    );
    assertEqual(
      opponentColors('skirmish', mine, [])!.length,
      0,
      'your own rescues were crossed off as the opponent’s',
    );
  });

  test('Color War asks for no row at all', () => {
    // Two colours in play, both already on the scoreboard beside the
    // scores. Six dots would say nothing.
    assertEqual(
      opponentColors('colorwar', fresh(), ['red']),
      null,
      'Color War drew a six-colour row',
    );
  });

  test('every colour has an ink that can be read on it', () => {
    /*
      There is no single ink that works: a dark cross vanishes on the
      palette's Blue and a white one vanishes on its Yellow. 3:1 is
      WCAG's floor for a graphic you have to make out, which is exactly
      what this is.
    */
    for (const c of PRISONER_COLORS) {
      const ratio = contrast(inkOn(c.hex), c.hex);
      assert(
        ratio >= 3,
        `a cross on ${c.label} has contrast ${ratio.toFixed(2)}:1 — too faint to see`,
      );
      note(`${c.label}: ${inkOn(c.hex) === '#ffffff' ? 'white' : 'dark'} cross, ${ratio.toFixed(1)}:1`);
    }
  });

  test('the die stickers and the cross agree about which ink to use', () => {
    /*
      Both ask the same question about the same six colours, and they
      used to answer it with two copies of the same threshold. One file
      now owns it — a sticker and a cross disagreeing on Yellow is the
      kind of thing nobody notices until Yellow looks broken.
    */
    const symbols = readFileSync('src/dice/symbols.ts', 'utf8');
    assert(
      symbols.includes('inkOn('),
      'the colourblind stickers keep their own copy of the ink rule',
    );
    assert(
      !/luminance\(face\) > 140/.test(symbols),
      'the old duplicated threshold is still in symbols.ts',
    );
  });
});

suite('game · color war shares the bottom row', () => {
  test('there is room for three each along the retreat', () => {
    // Both fighters' rescues now stand in the same row: yours on the
    // left three spots, your opponent's on the right three. The AI's used
    // to be paraded up on the far battlement instead.
    assertEqual(RETREAT_SLOTS.length, 6, 'the bottom row must seat six');
    const left = RETREAT_SLOTS.slice(0, 3);
    const right = RETREAT_SLOTS.slice(3);
    assert(
      left.every((s) => s.x < 0),
      'the first three spots are not on the left',
    );
    assert(
      right.every((s) => s.x > 0),
      'the last three spots are not on the right',
    );
    assert(
      Math.max(...left.map((s) => s.x)) < Math.min(...right.map((s) => s.x)),
      'the two halves of the row overlap',
    );
  });

  test('the two sides can be told apart by colour alone', () => {
    // Counting by station would add the two together now they share a
    // row, so each side is counted by its own colour.
    const [mine, theirs] = [PRISONER_COLORS[0], PRISONER_COLORS[1]];
    assert(mine.id !== theirs.id, 'color war drew the same colour twice');
    const units = makeUnits('colorwar', PRISONER_COLORS, mine, theirs);
    assertEqual(
      units.filter((u) => u.colorId === mine.id).length,
      3,
      'you should field three',
    );
    assertEqual(
      units.filter((u) => u.colorId === theirs.id).length,
      3,
      'your opponent should field three',
    );
  });
});

/**
 * The ladder as a climb, and as something you can look at.
 *
 * Marc, 27 Aug 2026, three things at once: "make the emojis on the ladder
 * section just the icons for each item. Flip the ladder around to go in
 * ascending order down. Change the trophy amount of some items so that
 * the highest thing is only 10 thousand trophies."
 */
suite('the ladder', () => {
  test('the summit is ten thousand trophies, exactly', () => {
    const top = TIERS[TIERS.length - 1];
    note(`the ladder ends at ${top.at} (${top.name})`);
    assertEqual(top.at, 10000, 'the top of the ladder has moved off 10,000');
  });

  test('every rung is harder than the one below it', () => {
    /*
      Not merely "no cheaper" — HARDER. A rung that costs the same climb
      as the one under it reads as a mistake, and once was one: the run
      above Midnight Dice used to open 350, 350.
    */
    let previous = 0;
    for (let i = 1; i < TIERS.length; i++) {
      const gap = TIERS[i].at - TIERS[i - 1].at;
      if (gap === 0) continue; // The two free rungs you start on.
      assert(
        gap > previous,
        `${TIERS[i].id} is ${gap} above ${TIERS[i - 1].id}, no more than the ${previous} before it`,
      );
      previous = gap;
    }
    note(`${TIERS.length} rungs, widening the whole way to a ${previous} final step`);
  });

  test('every rung has a picture of what it gives you', () => {
    /*
      The ladder draws each rung's own item — the real painted die, the
      real picture of the battlefield — rather than a hand-picked emoji
      standing in for it. That only works while every rung can be matched
      to something, so this is the check that keeps it working when a new
      rung is added.
    */
    const noPicture: string[] = [];
    for (const tier of TIERS) {
      if (tierItem(tier).kind === 'none') noPicture.push(tier.id);
    }
    assertEqual(
      noPicture.join(', '),
      TIERS_WITHOUT_A_PICTURE.join(', '),
      'a rung of the ladder has nothing to show for itself',
    );
    note(`${TIERS.length - noPicture.length} of ${TIERS.length} rungs show their own item`);
  });

  test('a new player is shown standing on both free rungs', () => {
    /*
      Marc, 28 Aug 2026: "have both the castle courtyard and ivory dice
      be highlighted on the ladder at the beginning."

      The ladder marks the rung you are on by comparing against your
      league, and a league is a single tier — the last one reached. Two
      rungs are free and both sit at 0, so at zero trophies one of them
      was marked YOU and the other looked like something still to earn.

      The screen picks by THRESHOLD now, so this is the check that the
      threshold really is shared and that nothing else on the ladder ties
      by accident — a tie anywhere else would light two rungs at once for
      a reason nobody intended.
    */
    const free = TIERS.filter((t) => t.at === 0);
    assertEqual(free.length, 2, 'the ladder should start with two free rungs');
    assertEqual(
      free.map((t) => t.id).join(', '),
      'castle, ivory-dice',
      'the two free rungs are not the ones the ladder starts with',
    );
    const ties = new Map<number, number>();
    for (const t of TIERS) ties.set(t.at, (ties.get(t.at) ?? 0) + 1);
    const shared = [...ties].filter(([, n]) => n > 1).map(([at, n]) => `${at} (${n})`);
    assertEqual(shared.join(', '), '0 (2)', 'more than one rung shares a threshold');

    const source = readFileSync('src/demo/LeaderboardScreen.tsx', 'utf8');
    const ladder = source.slice(source.indexOf('THE LADDER'));
    assert(
      /isCurrent = tier\.at === league\.at/.test(ladder),
      'the ladder marks the rung you are on by identity again, so only one of the two free rungs lights up',
    );
  });

  test('the ladder reads downwards, cheapest first', () => {
    // It used to be reversed, so the summit sat at the top the way a
    // leaderboard does. This is a road, not a leaderboard.
    const source = readFileSync('src/demo/LeaderboardScreen.tsx', 'utf8');
    const ladder = source.slice(source.indexOf('THE LADDER'));
    assert(
      !/\[\.\.\.TIERS\]\.reverse\(\)/.test(ladder),
      'the ladder is drawn upside down again',
    );
    assert(/\{TIERS\.map\(/.test(ladder), 'the ladder no longer walks TIERS in order');
  });

  test('no rung falls back to an emoji that has an item to show', () => {
    // The emoji is the fallback for Courtyard Treasure alone, which adds
    // gold to a courtyard rather than handing over a thing of its own.
    for (const id of TIERS_WITHOUT_A_PICTURE) {
      const tier = TIERS.find((t) => t.id === id);
      assert(tier !== undefined, `${id} is not on the ladder at all`);
      assert(!!tier!.emoji, `${id} has neither a picture nor an emoji`);
    }
  });
});
