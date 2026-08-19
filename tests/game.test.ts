import { AI_DIFFICULTIES, AI_ROSTER, pickOpponent, rollAiDice } from '../src/game/ai';
import { OBSTACLES_BY_DIFFICULTY } from '../src/game/obstacles';
import { DIE_FACE_COLORS, PRISONER_COLORS } from '../src/game/colors';
import { makeUnits, MODE_ORDER, MODES, ModeId } from '../src/game/modes';
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
import { assert, assertEqual, suite, test } from './harness';
import { averageOf } from '../src/game/rewards';

/** Rules, progression and palette invariants — pure logic, no physics. */

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
