"""The purchase sound: a coin ding-ding, a glittering run up the D major chord, a bell shimmer."""
import numpy as np
import synth as S
from synth import SR, hz, Mix
from tracks import write_wav

def blip(m, dur, shape='square', gain=0.3, decay=6.0):
    n = int((dur + 0.02) * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.002) * np.exp(-t * decay)
    env[int(dur * SR):] *= np.linspace(1, 0, n - int(dur * SR))
    return S.additive(hz(m), n, shape) * env * gain

def bell(m, dur, gain=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = (np.sin(2 * np.pi * hz(m) * t) + 0.5 * np.sin(2 * np.pi * hz(m) * 2.76 * t) * np.exp(-t * 3)
         + 0.25 * np.sin(2 * np.pi * hz(m) * 5.4 * t) * np.exp(-t * 6))
    return x * np.exp(-t * 3.2) * np.minimum(1, t / 0.003) * gain

mix = Mix(1.2, tail=0.8)
# The coin: B6 then a held E7, the sound every player already knows means "got it".
mix.place(blip(95, 0.07, decay=4), 0.0, -0.1, 'coin')
mix.place(blip(100, 0.42, decay=5.5), 0.07, -0.1, 'coin')
# The glitter: a quick run up D major, in 32nds, left and right.
for j, m in enumerate([74, 78, 81, 86, 90, 93, 98, 102]):
    mix.place(blip(m, 0.09, 'pulse0.125', 0.16, decay=14), 0.16 + j * 0.038, -0.5 if j % 2 else 0.5, 'glitter')
# The shimmer: a soft bell on the top D and A, and a low D underneath so it lands.
mix.place(bell(98, 0.9), 0.46, 0.3, 'bell')
mix.place(bell(105, 0.8, 0.1), 0.48, -0.3, 'bell')
mix.place(blip(62, 0.2, 'tri', 0.22, decay=9), 0.46, 0.0, 'bell')
x = mix.render({'coin': (1.0, 0.12), 'glitter': (1.0, 0.25), 'bell': (1.0, 0.3)}, loop=False)
write_wav('out/purchase.wav', S.master(x, drive=1.05))
print('ok')
