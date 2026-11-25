"""
Four original battle tracks for Dice Battles, composed here note by note.
Run: python3 tracks.py OUTDIR  (writes A-D as 44.1 kHz stereo WAV)
"""
import sys
import wave
import numpy as np
from functools import lru_cache
import synth as S
from synth import SR, hz, Mix

CHORDS = {
    # name: midi notes of a close voicing around middle C
    'D': (62, 66, 69), 'A': (61, 64, 69), 'Bm': (62, 66, 71), 'G': (62, 67, 71), 'Em': (64, 67, 71),
    'Dm7': (60, 65, 69, 72), 'G7': (59, 62, 65, 67), 'Bbmaj7': (62, 65, 69, 70), 'C': (60, 64, 67),
    'Am7': (60, 64, 67, 69), 'Am': (60, 64, 69), 'F': (60, 65, 69), 'B7': (63, 66, 69, 71),
    'Esus': (64, 69, 71), 'Bb': (58, 62, 65), 'E': (64, 68, 71), 'Dmaj7': (62, 66, 69, 73),
}
ROOT = {'D': 38, 'A': 33, 'Bm': 35, 'G': 31, 'Em': 40, 'Dm7': 38, 'G7': 31, 'Bbmaj7': 34, 'C': 36,
        'Am7': 33, 'Am': 33, 'F': 29, 'B7': 35, 'Esus': 40, 'Bb': 34, 'E': 40, 'Dmaj7': 38}


def seq(mix, notes, start, beat, inst, pan=0.0, bus='main', gain=1.0, transpose=0):
    """notes: [(midi or None, beats)] from `start` seconds."""
    t = start
    for m, b in notes:
        if m is not None:
            mix.place(inst(m + transpose, round(b * beat, 4)), t, pan, bus, gain)
        t += b * beat
    return t


def write_wav(path, stereo):
    data = np.clip(stereo.T, -1, 1)
    pcm = (data * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# ======================================================================
# A · PIXEL RUSH — chiptune, 160 BPM, D major
# ======================================================================
def track_a(kind='loop'):
    bpm = 160
    beat = 60 / bpm
    bar = 4 * beat
    prog_a = ['D', 'A', 'Bm', 'G'] * 2
    prog_b = ['Em', 'G', 'D', 'A', 'Em', 'G', 'A', 'A']
    prog_br = ['G', 'A', 'Bm', 'A']
    plan = [('A', prog_a), ('B', prog_b), ('A2', prog_a), ('BR', prog_br)]
    bars = sum(len(p) for _, p in plan)
    mix = Mix(bars * bar)

    @lru_cache(None)
    def lead(m, dur):
        n = int((dur + 0.08) * SR)
        env = S.adsr(n, a=0.003, d=0.09, s=0.55, r=0.05, gate=dur * 0.88)
        return S.additive(hz(m), n, 'square', vib=(6.0, 18, 0.12)) * env * 0.28

    @lru_cache(None)
    def harm(m, dur):
        n = int((dur + 0.08) * SR)
        env = S.adsr(n, a=0.003, d=0.09, s=0.45, r=0.05, gate=dur * 0.85)
        return S.additive(hz(m), n, 'pulse0.25') * env * 0.17

    @lru_cache(None)
    def arp(m, dur):
        n = int((dur + 0.02) * SR)
        env = S.adsr(n, a=0.002, d=0.05, s=0.3, r=0.02, gate=dur * 0.7)
        return S.additive(hz(m), n, 'pulse0.125') * env * 0.11

    @lru_cache(None)
    def bass(m, dur):
        n = int((dur + 0.03) * SR)
        env = S.adsr(n, a=0.002, d=0.12, s=0.8, r=0.03, gate=dur * 0.85)
        return S.additive(hz(m), n, 'tri') * env * 0.55

    @lru_cache(None)
    def kick():
        return S.kick(punch=0.6, length=0.22, low=55, high=170) * 0.8

    snare = S.chip_noise_drum('snare', 0.14)
    hatc = S.chip_noise_drum('hat', 0.05)

    if kind in ('fanfare', 'sting'):
        one = Mix(3.2 if kind == 'fanfare' else 1.4, tail=1.6)
        if kind == 'fanfare':
            # Up the D chord, a pause, then the high D held over a sparkling arpeggio.
            line = [(69, .25), (74, .25), (78, .25), (81, .25), (86, 1), (None, .25), (83, .25), (86, 2.5)]
            seq(one, line, 0, beat, lead, -0.1, 'lead')
            seq(one, [(m - 4 if m else None, b) for m, b in line], 0, beat, harm, 0.25, 'lead')
            for j, m in enumerate([74, 78, 81, 86, 90, 86, 81, 78] * 2):
                one.place(arp(m, round(beat / 4, 4)), 2.5 * beat + j * beat / 4, 0.35, 'arp')
            for b, m in [(0, 38), (1, 45), (2.5, 38)]:
                one.place(bass(m + 12, round(beat, 4)), b * beat, 0, 'bass')
            for b in (1, 2.5):
                one.place(kick(), b * beat, 0, 'drums')
                one.place(snare, b * beat, 0.05, 'drums')
            for j in range(4):
                one.place(snare, j * beat / 4, 0.05, 'drums', 0.4 + 0.15 * j)
        else:
            seq(one, [(62, .25), (66, .25), (69, .25), (74, 2)], 0, beat, lead, -0.1, 'lead')
            for j, m in enumerate([74, 78, 81, 86, 81, 78]):
                one.place(arp(m, round(beat / 4, 4)), 0.75 * beat + j * beat / 4, 0.35, 'arp')
            one.place(bass(50, round(2 * beat, 4)), 0.75 * beat, 0, 'bass')
            one.place(kick(), 0.75 * beat, 0, 'drums')
        return one.render({'lead': (1.0, 0.22), 'arp': (1.0, 0.2), 'bass': (1.0, 0.0), 'drums': (1.0, 0.05)}, loop=False)

    M1 = [(78, .5), (81, .5), (78, .5), (76, .5), (74, 1), (76, .5), (78, .5),
          (76, 1), (73, .5), (69, .5), (73, 1), (76, 1),
          (78, .5), (83, .5), (81, .5), (78, .5), (76, .5), (78, .5), (74, 1),
          (79, 1), (78, .5), (76, .5), (74, 1), (71, 1),
          (78, .5), (81, .5), (86, .5), (85, .5), (83, .5), (81, .5), (78, 1),
          (81, 1), (76, .5), (73, .5), (76, .5), (78, .5), (76, 1),
          (74, .5), (76, .5), (78, .5), (83, .5), (81, 1), (78, 1),
          (79, .5), (78, .5), (76, .5), (73, .5), (74, 2)]
    M2 = [(83, 1.5), (81, .5), (79, 1), (78, 1),
          (79, .5), (81, .5), (83, 1), (86, 1), (83, 1),
          (81, 1.5), (78, .5), (74, 1), (78, 1),
          (76, 2), (None, 1), (73, .5), (76, .5),
          (83, .5), (86, .5), (88, 1), (86, .5), (83, .5), (81, 1),
          (79, 1), (83, 1), (86, 1), (83, 1),
          (85, 1), (81, 1), (88, 1), (85, 1),
          (88, 2), (85, 1), (81, 1)]
    D_SCALE = [62, 64, 66, 67, 69, 71, 73]

    def third_below(m):
        pcs = [p % 12 for p in D_SCALE]
        if m % 12 not in pcs:
            return m - 3
        i = pcs.index(m % 12)
        target = pcs[(i - 2) % 7]
        d = (m % 12 - target) % 12
        return m - d

    t0 = 0.0
    for name, prog in plan:
        start = t0
        for i, ch in enumerate(prog):
            bt = start + i * bar
            r = ROOT[ch]
            # Bass: driving eighths, root and octave.
            for e in range(8):
                mix.place(bass(r + (12 if e % 2 else 0) + 12, round(beat / 2, 4)), bt + e * beat / 2, 0.0, 'bass')
            # Arpeggio: sixteenths up and down the chord, an octave up.
            tones = [c + 12 for c in CHORDS[ch]]
            cyc = tones + [tones[0] + 12] + tones[::-1][1:]
            for s in range(16):
                m = cyc[s % len(cyc)]
                if name == 'BR':
                    m += 12 if i >= 2 else 0
                mix.place(arp(m, round(beat / 4, 4)), bt + s * beat / 4, 0.35, 'arp')
            # Drums.
            for b in range(4):
                if b in (0, 2) or (b == 1 and name != 'A'):
                    if not (name == 'BR' and i == 3 and b > 0):
                        mix.place(kick(), bt + b * beat + (beat / 2 if b == 1 else 0), 0, 'drums')
                if b in (1, 3) and name != 'BR':
                    mix.place(snare, bt + b * beat, 0.05, 'drums')
                for h in range(2):
                    mix.place(hatc, bt + b * beat + h * beat / 2, -0.3, 'drums', 0.8 if h else 1.0)
            if name == 'BR':
                # A snare roll that tightens into the loop.
                div = 4 if i < 2 else 8
                for s in range(div):
                    mix.place(snare, bt + s * bar / div, 0.05, 'drums', 0.55 + 0.45 * (i * div + s) / (4 * 8))
        # Melody.
        if name == 'A':
            seq(mix, M1, start, beat, lead, -0.1, 'lead')
        elif name == 'B':
            seq(mix, M2, start, beat, lead, -0.1, 'lead')
        elif name == 'A2':
            seq(mix, M1, start, beat, lead, -0.1, 'lead')
            seq(mix, [(third_below(m) if m else None, b) for m, b in M1], start, beat, harm, 0.25, 'lead')
        elif name == 'BR':
            rise = [(74, 2), (76, 2), (78, 2), (81, 1), (85, 1), (86, 4), (85, 2), (88, 2)]
            seq(mix, rise, start, beat, lead, -0.1, 'lead')
        t0 += len(prog) * bar

    if kind == 'intense':
        # One rescue from the end: kick on every beat, sixteenth hats, the
        # arpeggio doubled an octave up and the tune doubled above itself.
        t0 = 0.0
        for name, prog in plan:
            for i, ch in enumerate(prog):
                bt = t0 + i * bar
                last = name == 'BR' and i == 3
                for b in (1, 3):
                    if not last:
                        mix.place(kick(), bt + b * beat, 0, 'drums', 0.85)
                for s16 in range(16):
                    if s16 % 2:
                        mix.place(hatc, bt + s16 * beat / 4, 0.3, 'drums', 0.7)
                tones = [c + 24 for c in CHORDS[ch]]
                cyc = tones + [tones[0] + 12] + tones[::-1][1:]
                for s16 in range(16):
                    mix.place(arp(cyc[s16 % len(cyc)], round(beat / 4, 4)), bt + s16 * beat / 4, -0.35, 'arp', 0.6)
                mix.place(snare, bt + 3.5 * beat, -0.05, 'drums', 0.45)
            if name in ('A', 'A2'):
                seq(mix, M1, t0, beat, harm, 0.3, 'lead', 0.8, transpose=12)
            elif name == 'B':
                seq(mix, M2, t0, beat, harm, 0.3, 'lead', 0.8, transpose=12)
            t0 += len(prog) * bar
    return mix.render({'lead': (1.0, 0.18), 'arp': (1.0, 0.15), 'bass': (1.0, 0.0), 'drums': (1.0, 0.05)})


# ======================================================================
# B · BRASS CHASE — funk, 132 BPM, D dorian
# ======================================================================
def track_b(kind='loop'):
    bpm = 132
    beat = 60 / bpm
    bar = 4 * beat
    s16 = beat / 4
    prog_a = ['Dm7', 'G7'] * 4
    prog_b = ['Bbmaj7', 'C', 'Am7', 'Dm7'] * 2
    plan = [('A', prog_a), ('B', prog_b), ('A2', prog_a), ('BRK', ['Dm7', 'Dm7', 'G7', 'G7'])]
    bars = sum(len(p) for _, p in plan)
    mix = Mix(bars * bar)

    @lru_cache(None)
    def sbass(m, dur):
        n = int((dur + 0.05) * SR)
        env = S.adsr(n, a=0.002, d=0.18, s=0.35, r=0.03, gate=dur * 0.9)
        return np.tanh(1.8 * S.additive(hz(m), n, 'saw', bright=lambda t: 0.08 + t * 14)) * env * 0.5

    @lru_cache(None)
    def stab(ch, dur):
        n = int((dur + 0.12) * SR)
        env = S.adsr(n, a=0.012, d=0.12, s=0.6, r=0.08, gate=dur * 0.85)
        out = np.zeros(n)
        for m in CHORDS[ch]:
            for c in (-9, 9):
                out += S.additive(hz(m + 12), n, 'saw', detune_cents=c,
                                  bright=lambda t: 0.06 + 0.5 * np.clip(t * 4, 0, 1))
        return out * env * 0.07

    @lru_cache(None)
    def pad(ch, dur):
        n = int((dur + 0.3) * SR)
        env = S.adsr(n, a=0.06, d=0.4, s=0.7, r=0.25, gate=dur * 0.95)
        out = np.zeros(n)
        for m in CHORDS[ch]:
            for c in (-7, 7):
                out += S.additive(hz(m + 12), n, 'saw', detune_cents=c, bright=lambda t: 0.25 + 0 * t)
        return out * env * 0.045

    @lru_cache(None)
    def clav(ch, dur):
        n = int((dur + 0.03) * SR)
        env = S.adsr(n, a=0.001, d=0.05, s=0.0, r=0.02, gate=dur)
        out = np.zeros(n)
        for m in CHORDS[ch]:
            out += S.additive(hz(m + 12), n, 'pulse0.2', bright=lambda t: t * 30)
        return out * env * 0.06

    @lru_cache(None)
    def horn(m, dur):
        n = int((dur + 0.1) * SR)
        env = S.adsr(n, a=0.02, d=0.15, s=0.75, r=0.06, gate=dur * 0.9)
        x = S.additive(hz(m), n, 'saw', vib=(5.5, 22, 0.18),
                       bright=lambda t: 0.05 + 0.25 * np.exp(-t * 6)) * 0.6
        x += S.additive(hz(m), n, 'saw', detune_cents=8) * 0.4
        return np.tanh(1.3 * x) * env * 0.17

    kick = S.kick(punch=1.0, length=0.3)
    snare = S.snare(0.22, tone=200)
    clp = S.clap()
    hc = S.hat()
    ho = S.hat(open_=True, length=0.25)

    if kind in ('fanfare', 'sting'):
        one = Mix(3.0 if kind == 'fanfare' else 1.4, tail=1.6)
        if kind == 'fanfare':
            # The classic horn-section finish: B flat, C, then D, held with a shake on top.
            hits = [('Bb', 0, .5), ('C', .75, .5), ('D', 1.5, 3)]
            for ch, at, ln in hits:
                one.place(stab(ch, round(ln * beat, 4)), at * beat, 0.0, 'keys', 1.6)
                one.place(sbass(ROOT[ch] + 12, round(min(ln, 1) * beat, 4)), at * beat, 0, 'bass')
                one.place(kick, at * beat, 0, 'drums')
                one.place(snare, at * beat, 0.05, 'drums')
                one.place(clp, at * beat, -0.05, 'drums', 0.7)
            seq(one, [(None, 1.5), (81, .25), (83, .25), (81, .25), (83, .25), (86, 2.25)], 0, beat, horn, 0.15, 'lead')
            for j in range(6):
                one.place(hc, 1.5 * beat + j * beat / 2, 0.3, 'drums', 0.6)
        else:
            for j, m in enumerate([38, 45, 48, 50]):
                one.place(sbass(m + 12, round(beat / 4, 4)), j * beat / 4, 0, 'bass')
            one.place(stab('Dm7', round(1.5 * beat, 4)), beat, 0.0, 'keys', 1.5)
            seq(one, [(None, 1), (81, 1.5)], 0, beat, horn, 0.15, 'lead')
            one.place(kick, beat, 0, 'drums')
            one.place(clp, beat, 0, 'drums', 0.7)
        return one.render({'lead': (1.0, 0.25), 'keys': (1.0, 0.2), 'bass': (1.0, 0.0), 'drums': (1.0, 0.06)}, loop=False)

    # Bass pattern, 16th positions relative to the root.
    BASS = [(0, 0, 2), (3, 0, 1), (6, 12, 1), (7, 10, 1), (8, 0, 2), (10, 7, 1), (11, 10, 1), (14, 12, 1), (15, 7, 1)]
    RIFF = [(None, .5), (74, .25), (77, .25), (79, .5), (81, .5), (None, .5), (84, .5), (81, .5), (79, .5),
            (77, .75), (79, .25), (77, .5), (74, 1), (None, 1.5),
            (None, .5), (74, .25), (77, .25), (79, .5), (81, .5), (None, .5), (84, .5), (81, .5), (79, .5),
            (81, .5), (83, .5), (84, 1), (81, .5), (79, .5), (77, .5), (79, .5)]
    BLINE = [(81, 2), (79, 1), (77, 1), (79, 3), (None, 1), (76, 2), (77, 1), (79, 1), (74, 3), (None, 1),
             (81, 2), (84, 1), (86, 1), (84, 3), (None, 1), (88, 2), (86, 1), (84, 1), (86, 4)]

    t0 = 0.0
    for name, prog in plan:
        start = t0
        for i, ch in enumerate(prog):
            bt = start + i * bar
            r = ROOT[ch]
            brk = name == 'BRK'
            for pos, iv, ln in BASS:
                if brk and i < 2 and pos > 8:
                    continue
                mix.place(sbass(r + iv + 12, round(ln * s16, 4)), bt + pos * s16, 0.0, 'bass')
            # Drums: kick on 1, the "and" of 2 and 3; snare 2 and 4; sixteenth hats.
            if not (brk and i < 2):
                for pos in (0, 6, 10):
                    mix.place(kick, bt + pos * s16, 0, 'drums')
            else:
                mix.place(kick, bt, 0, 'drums')
            for pos in (4, 12):
                mix.place(snare, bt + pos * s16, 0.05, 'drums')
                if name in ('B', 'A2'):
                    mix.place(clp, bt + pos * s16, -0.05, 'drums', 0.6)
            for pos in range(16):
                if pos == 14 and name != 'BRK':
                    mix.place(ho, bt + pos * s16, 0.3, 'drums', 0.7)
                elif pos != 15:
                    mix.place(hc, bt + pos * s16, 0.3, 'drums', 0.9 if pos % 2 == 0 else 0.55)
            # Harmony.
            if name in ('A', 'A2'):
                for pos in (6, 12):
                    mix.place(stab(ch, round(2 * s16, 4)), bt + pos * s16, 0.0, 'keys')
                for pos in (2, 9, 13):
                    mix.place(clav(ch, round(s16, 4)), bt + pos * s16, -0.35, 'keys')
            elif name == 'B':
                mix.place(pad(ch, round(bar, 4)), bt, 0.0, 'keys')
                for pos in (3, 7, 11, 15):
                    mix.place(clav(ch, round(s16, 4)), bt + pos * s16, -0.35, 'keys')
            elif brk and i >= 2:
                for pos in (0, 3, 6, 10, 12, 14):
                    mix.place(stab(ch, round(1.5 * s16, 4)), bt + pos * s16, 0.0, 'keys', 1.15)
        if name == 'A2':
            seq(mix, RIFF + RIFF, start, beat, horn, 0.15, 'lead')
        elif name == 'B':
            seq(mix, BLINE, start, beat, horn, 0.15, 'lead')
        t0 += len(prog) * bar

    if kind == 'intense':
        # The horns never stop: the riff comes in from the first bar, stabs
        # over the B section too, a shaker on every sixteenth, a cowbell on
        # the beat and claps throughout.
        t0 = 0.0
        bell = S.tom(88, 0.09) * 0.35
        for name, prog in plan:
            for i, ch in enumerate(prog):
                bt = t0 + i * bar
                for pos in range(16):
                    mix.place(hc, bt + pos * s16, -0.4, 'drums', 0.5)
                for b in range(4):
                    mix.place(bell, bt + b * beat, 0.45, 'drums')
                if name != 'BRK':
                    mix.place(kick, bt + 14 * s16, 0, 'drums', 0.8)
                    for pos in (4, 12):
                        mix.place(clp, bt + pos * s16, -0.05, 'drums', 0.6)
                if name == 'B':
                    for pos in (6, 12):
                        mix.place(stab(ch, round(2 * s16, 4)), bt + pos * s16, 0.0, 'keys', 0.9)
            if name == 'A':
                seq(mix, RIFF + RIFF, t0, beat, horn, 0.15, 'lead')
            if name == 'A2':
                seq(mix, RIFF + RIFF, t0, beat, horn, -0.2, 'lead', 0.5, transpose=-12)
            t0 += len(prog) * bar
    return mix.render({'lead': (1.0, 0.22), 'keys': (1.0, 0.2), 'bass': (1.0, 0.0), 'drums': (1.0, 0.06)})


# ======================================================================
# C · SURF DASH — surf rock, 172 BPM, E minor
# ======================================================================
def track_c(kind='loop'):
    bpm = 172
    beat = 60 / bpm
    bar = 4 * beat
    prog_a = ['Em', 'Em', 'C', 'C', 'Am', 'Am', 'B7', 'B7']
    prog_b = ['Am', 'Am', 'Em', 'Em', 'C', 'C', 'B7', 'B7']
    plan = [('A', prog_a), ('B', prog_b), ('A2', prog_a), ('FILL', ['Em', 'B7'])]
    bars = sum(len(p) for _, p in plan)
    mix = Mix(bars * bar)

    @lru_cache(None)
    def gtr(m, dur):
        n = int((dur + 0.05) * SR)
        x = S.pluck(hz(m), n, damp=0.997, bright=0.75)
        env = S.adsr(n, a=0.001, d=1.0, s=1.0, r=0.03, gate=dur)
        return np.tanh(2.2 * x) * env * 0.2

    @lru_cache(None)
    def chug(ch, dur):
        n = int((dur + 0.03) * SR)
        out = np.zeros(n)
        for j, m in enumerate(CHORDS[ch]):
            out[int(j * 0.006 * SR):] += S.pluck(hz(m), n - int(j * 0.006 * SR), damp=0.99, bright=0.5)
        env = S.adsr(n, a=0.001, d=1.0, s=1.0, r=0.02, gate=dur * 0.7)
        return np.tanh(1.5 * out) * env * 0.09

    @lru_cache(None)
    def bass(m, dur):
        n = int((dur + 0.04) * SR)
        env = S.adsr(n, a=0.003, d=0.2, s=0.6, r=0.03, gate=dur * 0.9)
        x = S.additive(hz(m), n, 'saw', bright=lambda t: 0.35 + t * 4) * 0.6 + S.additive(hz(m), n, 'sine') * 0.6
        return x * env * 0.45

    @lru_cache(None)
    def organ(ch, dur):
        n = int((dur + 0.1) * SR)
        env = S.adsr(n, a=0.02, d=0.2, s=0.9, r=0.08, gate=dur * 0.95)
        out = np.zeros(n)
        for m in CHORDS[ch]:
            out += S.additive(hz(m), n, 'sine') + 0.5 * S.additive(hz(m + 12), n, 'sine') + 0.3 * S.additive(hz(m + 19), n, 'sine')
        t = np.arange(n) / SR
        return out * env * (1 + 0.25 * np.sin(2 * np.pi * 6.5 * t)) * 0.035

    kick = S.kick(punch=0.8, length=0.3, low=52)
    snare = S.snare(0.25, tone=210, snap=1.1)
    ride = S.hat(open_=True, length=0.3) * 0.6
    crash = S.crash()

    if kind in ('fanfare', 'sting'):
        one = Mix(3.2 if kind == 'fanfare' else 1.5, tail=1.8)

        def trem(notes, start, gain=1.0):
            t = start
            for m, b in notes:
                if m is not None:
                    for j in range(int(round(b * 4))):
                        one.place(gtr(m, round(beat / 4, 4)), t + j * beat / 4, -0.2, 'lead', gain * (1.0 if j == 0 else 0.72))
                t += b * beat

        if kind == 'fanfare':
            # A run up the scale into a ringing E major chord, toms and a crash.
            trem([(71, .5), (74, .5), (76, .5), (79, .5), (83, 2.5)], 0, 1.7)
            one.place(chug('E', round(3 * beat, 4)), 2 * beat, 0.35, 'rhythm', 2.0)
            one.place(bass(52, round(2.5 * beat, 4)), 2 * beat, 0, 'bass')
            for j, m in enumerate([50, 47, 45, 43]):
                one.place(S.tom(m), j * beat / 2, (j - 2) / 4, 'drums', 0.8)
            one.place(kick, 2 * beat, 0, 'drums')
            one.place(crash, 2 * beat, -0.3, 'drums', 0.9)
        else:
            trem([(64, .25), (67, .25), (71, .25), (76, 2)], 0, 1.6)
            one.place(gtr(40, round(3 * beat, 4)), 0.75 * beat, 0, 'lead', 1.4)
            one.place(kick, 0.75 * beat, 0, 'drums')
        return one.render({'lead': (1.0, 0.35), 'rhythm': (1.0, 0.3), 'bass': (0.8, 0.0), 'drums': (1.0, 0.08)}, loop=False)

    MA = [(71, 1), (74, 1), (76, 1), (79, 1), (78, 1.5), (76, .5), (74, 1), (71, 1),
          (72, 1), (76, 1), (79, 1), (76, 1), (74, 2), (72, 1), (71, 1),
          (69, 1), (72, 1), (76, 1), (81, 1), (79, 1.5), (76, .5), (72, 2),
          (75, 1), (78, 1), (81, 1), (78, 1), (75, 2), (71, 2)]
    MB = [(81, 2), (79, 1), (76, 1), (76, 1), (79, 1), (81, 2),
          (83, 2), (81, 1), (79, 1), (76, 3), (None, 1),
          (79, 1), (81, 1), (83, 1), (84, 1), (83, 2), (79, 2),
          (78, 1), (81, 1), (83, 1), (87, 1), (87, 2), (83, 2)]

    def tremolo(notes, start, transpose=0, gain=1.0):
        """Surf picking: every melody note is played as fast sixteenths."""
        t = start
        for m, b in notes:
            if m is not None:
                k = int(round(b * 4))
                for j in range(k):
                    mix.place(gtr(m + transpose, round(beat / 4, 4)), t + j * beat / 4, -0.2, 'lead',
                              gain * (1.0 if j == 0 else 0.72))
            t += b * beat

    t0 = 0.0
    for name, prog in plan:
        start = t0
        for i, ch in enumerate(prog):
            bt = start + i * bar
            r = ROOT[ch]
            walk = [0, 0, 7, 7, 12, 12, 7, 10] if i % 2 == 0 else [0, 0, 7, 7, 12, 10, 7, 5]
            for e, iv in enumerate(walk):
                mix.place(bass(r + 12 + iv, round(beat / 2, 4)), bt + e * beat / 2, 0.0, 'bass')
            for b in range(4):
                mix.place(chug(ch, round(beat / 2, 4)), bt + b * beat + beat / 2, 0.35, 'rhythm')
            if name == 'B':
                if i % 2 == 0:
                    mix.place(organ(ch, round(2 * bar, 4)), bt, 0.0, 'keys')
            # Drums.
            if name == 'FILL' and i == 1:
                for s, m in enumerate([50, 50, 47, 47, 45, 45, 43, 43]):
                    mix.place(S.tom(m), bt + s * beat / 2, (s - 4) / 6, 'drums', 0.9)
            else:
                for pos in (0, 2):
                    mix.place(kick, bt + pos * beat, 0, 'drums')
                mix.place(kick, bt + 2.5 * beat, 0, 'drums', 0.7)
                for pos in (1, 3):
                    mix.place(snare, bt + pos * beat, 0.05, 'drums')
                for e in range(8):
                    mix.place(ride, bt + e * beat / 2, 0.3, 'drums', 0.9 if e % 2 == 0 else 0.6)
            if i == 0 and name in ('A', 'B', 'A2'):
                mix.place(crash, bt, -0.3, 'drums', 0.8)
        if name == 'A':
            tremolo(MA, start)
        elif name == 'B':
            tremolo(MB, start)
        elif name == 'A2':
            tremolo(MA, start, transpose=12, gain=0.8)
            tremolo(MA, start, gain=0.55)
        elif name == 'FILL':
            seq(mix, [(76, .5), (75, .5), (74, .5), (73, .5), (72, .5), (71, .5), (70, .5), (69, .5)], start, beat,
                gtr, -0.2, 'lead')
        t0 += len(prog) * bar

    return mix.render({'lead': (1.7, 0.3), 'rhythm': (0.75, 0.25), 'keys': (1.0, 0.2), 'bass': (0.8, 0.0),
                       'drums': (1.0, 0.08)})


# ======================================================================
# D · NEON SPRINT — synth-pop / electro, 150 BPM, A minor
# ======================================================================
def track_d(kind='loop'):
    bpm = 150
    beat = 60 / bpm
    bar = 4 * beat
    prog = ['Am', 'F', 'C', 'G']
    plan = [('A', prog * 2), ('B', prog * 2), ('A2', prog * 2), ('BUILD', prog)]
    bars = sum(len(p) for _, p in plan)
    mix = Mix(bars * bar)

    @lru_cache(None)
    def chord(ch, dur):
        n = int((dur + 0.2) * SR)
        env = S.adsr(n, a=0.01, d=0.3, s=0.8, r=0.15, gate=dur * 0.95)
        out = np.zeros(n)
        for m in CHORDS[ch]:
            out += S.supersaw(hz(m + 12), n, voices=5, spread=22, bright=lambda t: 0.12 + 0 * t)
        return out * env * 0.1

    @lru_cache(None)
    def bass(m, dur):
        n = int((dur + 0.02) * SR)
        env = S.adsr(n, a=0.002, d=0.08, s=0.6, r=0.02, gate=dur * 0.8)
        return np.tanh(1.5 * S.additive(hz(m), n, 'saw', bright=lambda t: 0.3 + t * 8)) * env * 0.4

    @lru_cache(None)
    def lead(m, dur):
        n = int((dur + 0.1) * SR)
        env = S.adsr(n, a=0.005, d=0.12, s=0.75, r=0.06, gate=dur * 0.9)
        x = S.additive(hz(m), n, 'saw', detune_cents=-6, vib=(5.8, 20, 0.15)) * 0.5
        x += S.additive(hz(m), n, 'square', detune_cents=6, vib=(5.8, 20, 0.15)) * 0.5
        return x * env * 0.2

    @lru_cache(None)
    def spark(m, dur):
        n = int((dur + 0.02) * SR)
        env = S.adsr(n, a=0.001, d=0.06, s=0.2, r=0.02, gate=dur * 0.6)
        return S.additive(hz(m), n, 'pulse0.3') * env * 0.07

    kick = S.kick(punch=1.0, length=0.32, low=46, high=160)
    clp = S.clap()
    hc = S.hat()
    ho = S.hat(open_=True, length=0.22)

    if kind in ('fanfare', 'sting'):
        one = Mix(3.0 if kind == 'fanfare' else 1.4, tail=1.8)
        if kind == 'fanfare':
            # F, G, then a bright A major to finish: the minor key turns major for the win.
            for ch, at, ln in [('F', 0, .75), ('G', .75, .75), ('A', 1.5, 3)]:
                one.place(chord(ch, round(ln * beat, 4)), at * beat, 0.0, 'synth', 1.4)
                one.place(bass(ROOT[ch] + 12, round(min(ln, 1) * beat, 4)), at * beat, 0, 'bass')
                one.place(kick, at * beat, 0, 'drums')
                one.place(clp, at * beat, 0, 'drums', 0.8)
            seq(one, [(72, .375), (74, .375), (76, .375), (79, .375), (81, 3)], 0, beat, lead, 0.0, 'lead')
            for j, m in enumerate([81, 85, 88, 93] * 3):
                one.place(spark(m, round(beat / 4, 4)), 1.5 * beat + j * beat / 4, 0.4 if j % 2 else -0.4, 'arp')
        else:
            for j, m in enumerate([69, 72, 76, 81]):
                one.place(spark(m + 12, round(beat / 4, 4)), j * beat / 4, 0.4 if j % 2 else -0.4, 'arp', 1.5)
            one.place(chord('Am', round(1.5 * beat, 4)), beat, 0.0, 'synth', 1.4)
            one.place(bass(45, round(beat, 4)), beat, 0, 'bass')
            one.place(kick, beat, 0, 'drums')
            seq(one, [(None, 1), (81, 1.5)], 0, beat, lead, 0.0, 'lead')
        return one.render({'synth': (0.85, 0.2), 'lead': (1.45, 0.22), 'arp': (1.0, 0.25), 'bass': (1.0, 0.0), 'drums': (1.0, 0.04)}, loop=False)

    HOOK = [(76, .5), (76, .5), (None, .5), (72, .5), (76, .5), (79, 1), (76, .5),
            (77, .5), (76, .5), (72, .5), (69, 1), (None, .5), (72, .5), (74, .5),
            (76, .5), (76, .5), (None, .5), (72, .5), (76, .5), (79, .5), (84, 1),
            (83, 1), (79, .5), (74, .5), (79, 1.5), (None, .5)]
    HOOK2 = HOOK[:-4] + [(83, .5), (84, .5), (86, 1), (88, 2)]

    t0 = 0.0
    for name, chords in plan:
        start = t0
        for i, ch in enumerate(chords):
            bt = start + i * bar
            r = ROOT[ch]
            build = name == 'BUILD'
            mix.place(chord(ch, round(bar, 4)), bt, 0.0, 'synth', 0.7 if build else 1.0)
            # Rolling octave bass, sixteenths.
            if not build or i < 2:
                for s in range(16):
                    mix.place(bass(r + 12 + (12 if s % 2 else 0), round(beat / 4, 4)), bt + s * beat / 4, 0.0, 'bass')
            # Sparkle arpeggio.
            tones = [c + 24 for c in CHORDS[ch]]
            for s in range(16):
                m = tones[(s * 2) % len(tones)] + (12 if s % 4 == 3 else 0)
                mix.place(spark(m, round(beat / 4, 4)), bt + s * beat / 4, 0.4 if s % 2 else -0.4, 'arp')
            # Drums: four on the floor, clap on 2 and 4, open hat on the offbeat.
            for b in range(4):
                if not build:
                    mix.place(kick, bt + b * beat, 0, 'drums')
                    mix.place(ho, bt + b * beat + beat / 2, 0.25, 'drums', 0.8)
                if b in (1, 3) and not build:
                    mix.place(clp, bt + b * beat, 0.0, 'drums')
                for h in range(4):
                    if not build:
                        mix.place(hc, bt + b * beat + h * beat / 4, -0.25, 'drums', 0.5 if h % 2 else 0.3)
            if build:
                # Claps double up into the drop.
                div = 4 * (2 ** min(i, 2))
                for s in range(div):
                    mix.place(clp, bt + s * bar / div, 0.0, 'drums', 0.5 + 0.5 * (i * 16 + s) / 64)
        if name == 'B':
            seq(mix, HOOK + HOOK2, start, beat, lead, 0.0, 'lead')
        elif name == 'A2':
            seq(mix, HOOK + HOOK2, start, beat, lead, 0.0, 'lead')
            seq(mix, HOOK + HOOK2, start, beat, lead, 0.2, 'lead', 0.5, transpose=-12)
        elif name == 'BUILD':
            seq(mix, [(69, 4), (72, 4), (76, 4), (79, 2), (81, 2)], start, beat, lead, 0.0, 'lead', 0.9)
        t0 += len(chords) * bar

    if kind == 'intense':
        # The hook from the very first bar, doubled an octave up, louder
        # sixteenth hats, the sparkle doubled, and a clap fill every four bars.
        t0 = 0.0
        for name, chords in plan:
            for i, ch in enumerate(chords):
                bt = t0 + i * bar
                build = name == 'BUILD'
                if not build:
                    for s16 in range(16):
                        mix.place(hc, bt + s16 * beat / 4, 0.3, 'drums', 0.55)
                    if i % 4 == 3:
                        for s16 in range(12, 16):
                            mix.place(clp, bt + s16 * beat / 4, 0.0, 'drums', 0.5 + 0.1 * (s16 - 12))
                tones = [c + 36 for c in CHORDS[ch]]
                for s16 in range(16):
                    mix.place(spark(tones[(s16 * 2 + 1) % len(tones)], round(beat / 4, 4)), bt + s16 * beat / 4,
                              -0.4 if s16 % 2 else 0.4, 'arp', 0.7)
            if name == 'A':
                seq(mix, HOOK + HOOK2, t0, beat, lead, 0.0, 'lead', 0.85)
            if name in ('A', 'B', 'A2'):
                seq(mix, HOOK + HOOK2, t0, beat, lead, -0.25, 'lead', 0.35, transpose=12)
            t0 += len(chords) * bar
    return mix.render({'synth': (0.85, 0.18), 'lead': (1.45, 0.22), 'arp': (1.0, 0.25), 'bass': (1.0, 0.0),
                       'drums': (1.0, 0.04)},
                      pump=(beat, 0.55, ('synth', 'bass')))



# ======================================================================
# LOBBY — Pixel Rush slowed and softened for the menus, 104 BPM, D major
# ======================================================================
def track_lobby(kind='loop'):
    bpm = 104
    beat = 60 / bpm
    bar = 4 * beat
    prog_a = ['D', 'A', 'Bm', 'G'] * 2
    prog_b = ['Em', 'G', 'D', 'A', 'Em', 'G', 'A', 'A']
    prog_o = ['G', 'A', 'Bm', 'A']
    plan = [('A', prog_a), ('B', prog_b), ('A2', prog_a), ('OUT', prog_o)]
    bars = sum(len(p) for _, p in plan)
    mix = Mix(bars * bar, tail=4.0)

    @lru_cache(None)
    def lead(m, dur):
        n = int((dur + 0.25) * SR)
        env = S.adsr(n, a=0.02, d=0.25, s=0.6, r=0.2, gate=dur * 0.92)
        return S.additive(hz(m), n, 'pulse0.25', vib=(5.0, 14, 0.2), bright=lambda t: 0.25 + 0 * t) * env * 0.22

    @lru_cache(None)
    def keys(m, dur):
        n = int((dur + 0.3) * SR)
        env = S.adsr(n, a=0.005, d=0.6, s=0.25, r=0.25, gate=dur * 0.9)
        return S.additive(hz(m), n, 'tri') * env * 0.16

    @lru_cache(None)
    def bass(m, dur):
        n = int((dur + 0.1) * SR)
        env = S.adsr(n, a=0.005, d=0.3, s=0.7, r=0.08, gate=dur * 0.85)
        return S.additive(hz(m), n, 'tri') * env * 0.5

    @lru_cache(None)
    def kick():
        return S.kick(punch=0.3, length=0.25, low=58, high=120) * 0.45

    tick = S.chip_noise_drum('hat', 0.04) * 0.55
    rim = S.chip_noise_drum('snare', 0.06) * 0.4

    M1 = [(78, .5), (81, .5), (78, .5), (76, .5), (74, 1), (76, .5), (78, .5),
          (76, 1), (73, .5), (69, .5), (73, 1), (76, 1),
          (78, .5), (83, .5), (81, .5), (78, .5), (76, .5), (78, .5), (74, 1),
          (79, 1), (78, .5), (76, .5), (74, 1), (71, 1),
          (78, .5), (81, .5), (86, .5), (85, .5), (83, .5), (81, .5), (78, 1),
          (81, 1), (76, .5), (73, .5), (76, .5), (78, .5), (76, 1),
          (74, .5), (76, .5), (78, .5), (83, .5), (81, 1), (78, 1),
          (79, .5), (78, .5), (76, .5), (73, .5), (74, 2)]
    M2 = [(83, 1.5), (81, .5), (79, 1), (78, 1),
          (79, .5), (81, .5), (83, 1), (86, 1), (83, 1),
          (81, 1.5), (78, .5), (74, 1), (78, 1),
          (76, 2), (None, 1), (73, .5), (76, .5),
          (83, .5), (86, .5), (88, 1), (86, .5), (83, .5), (81, 1),
          (79, 1), (83, 1), (86, 1), (83, 1),
          (85, 1), (81, 1), (88, 1), (85, 1),
          (88, 2), (85, 1), (81, 1)]

    t0 = 0.0
    for name, prog in plan:
        for i, ch in enumerate(prog):
            bt = t0 + i * bar
            r = ROOT[ch]
            # Bass on the beat, root and fifth.
            for b, iv in enumerate((0, 7, 12, 7)):
                mix.place(bass(r + 12 + iv, round(beat, 4)), bt + b * beat, 0.0, 'bass')
            # Broken chords in eighths, an octave up, gently.
            tones = [c + 12 for c in CHORDS[ch]]
            cyc = tones + [tones[0] + 12] + tones[::-1][1:]
            for e in range(8):
                mix.place(keys(cyc[e % len(cyc)], round(beat / 2, 4)), bt + e * beat / 2, 0.3 if e % 2 else -0.3, 'keys')
            # A light beat: soft kick on 1 and 3, a tick on the offbeats, a rim click on 4.
            if name != 'OUT' or i < 2:
                for b in (0, 2):
                    mix.place(kick(), bt + b * beat, 0, 'drums')
                for e in range(8):
                    if e % 2:
                        mix.place(tick, bt + e * beat / 2, -0.3, 'drums')
                mix.place(rim, bt + 3 * beat, 0.1, 'drums')
        if name in ('A', 'A2'):
            seq(mix, M1, t0, beat, lead, -0.1, 'lead')
        elif name == 'B':
            seq(mix, M2, t0, beat, lead, -0.1, 'lead', 0.9)
        elif name == 'OUT':
            seq(mix, [(74, 4), (76, 4), (78, 6), (76, 2)], t0, beat, lead, -0.1, 'lead', 0.8)
        t0 += len(prog) * bar
    return mix.render({'lead': (1.0, 0.3), 'keys': (1.0, 0.3), 'bass': (1.0, 0.05), 'drums': (1.0, 0.08)})

if __name__ == '__main__':
    out = sys.argv[1]
    which = sys.argv[2:] or ['A', 'B', 'C', 'D']
    fns = {'A': track_a, 'B': track_b, 'C': track_c, 'D': track_d, 'L': track_lobby}
    kinds = {'A': ('loop', 'intense', 'fanfare', 'sting'), 'B': ('loop', 'intense', 'fanfare', 'sting'),
             'C': ('loop', 'fanfare', 'sting'), 'D': ('loop', 'intense', 'fanfare', 'sting'), 'L': ('loop',)}
    for k in which:
        for kind in kinds[k]:
            x = S.master(fns[k](kind))
            name = k if kind == 'loop' else f'{k}-{kind}'
            write_wav(f'{out}/{name}.wav', x)
            print(name, f'{x.shape[1] / SR:.1f}s')
