"""The rescue cheer, our own: a burst of applause from a crowd of synthesised claps,
a cheery rising whistle, and a quick bright "ta-da" on top. Replaces a CC-BY recording."""
import numpy as np
import synth as S
from synth import SR, hz, Mix
from tracks import write_wav

rng = np.random.default_rng(7)
mix = Mix(1.6, tail=0.9)

def one_clap(bright):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    x = S.noise(n)
    # A hand clap is a short burst of noise with a body around 1-2 kHz: smooth less for brighter hands.
    x = S.lp(S.hp(x), 2 if bright else 4)
    return x * np.exp(-t * (55 + 30 * rng.random())) * (0.5 + 0.5 * rng.random())

# Applause: some forty people clapping, each at their own pace, swelling then thinning out.
for person in range(42):
    pace = 0.13 + 0.07 * rng.random()
    t = 0.02 + 0.12 * rng.random()
    end = 0.9 + 0.7 * rng.random()
    while t < end:
        swell = min(1.0, t / 0.25) * (1.0 - max(0.0, t - 0.8) / 1.0)
        mix.place(one_clap(rng.random() < 0.5) * 0.22 * max(0.0, swell), t, rng.uniform(-0.8, 0.8), 'crowd')
        t += pace * (0.85 + 0.3 * rng.random())

# A cheery whistle: a sine gliding up an octave, then a little dip and rise.
n = int(0.75 * SR); t = np.arange(n) / SR
f = np.where(t < 0.28, hz(79) * 2 ** (t / 0.28), hz(91) * (1 + 0.04 * np.sin(2 * np.pi * 7 * (t - 0.28))))
whistle = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t / 0.03) * np.exp(-np.maximum(0, t - 0.45) * 5) * 0.13
mix.place(whistle, 0.05, 0.35, 'whistle')

# Ta-da: two quick bright notes, the second held, in D major like the lobby and the purchase sound.
def note(m, dur, gain):
    nn = int((dur + 0.15) * SR); tt = np.arange(nn) / SR
    env = np.minimum(1, tt / 0.004) * np.exp(-tt * 3.5)
    return (S.additive(hz(m), nn, 'pulse0.25') * 0.6 + S.additive(hz(m + 12), nn, 'sine') * 0.4) * env * gain
mix.place(note(81, 0.1, 0.16), 0.0, -0.2, 'tada')
mix.place(note(86, 0.5, 0.18), 0.1, -0.2, 'tada')
mix.place(note(78, 0.5, 0.10), 0.1, 0.2, 'tada')

x = mix.render({'crowd': (1.0, 0.25), 'whistle': (1.0, 0.2), 'tada': (1.0, 0.2)}, loop=False)
write_wav('out/cheer.wav', S.master(x, drive=1.05))
print('ok')
