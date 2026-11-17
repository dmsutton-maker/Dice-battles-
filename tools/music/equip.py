"""The equip bloop: two rounded bubble pops sliding up to D5 and A5. Ours, replaces equip.wav."""
import wave
import numpy as np
SR = 44100

def bloop(f_end, dur, gain, start_ratio=0.45):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # A bubble: the pitch rises fast then settles, the level pops then dies away.
    f = f_end * (start_ratio + (1 - start_ratio) * (1 - np.exp(-t / 0.018)))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.003) * np.exp(-t * 16)
    # Fade the last 40 ms to nothing, so the end of a bloop is never a click.
    k = int(0.04 * SR)
    env[-k:] *= np.linspace(1, 0, k) ** 2
    return tone * env * gain

n = int(0.42 * SR)
x = np.zeros(n)
a = bloop(587.33, 0.24, 1.0)
b = bloop(880.0, 0.30, 0.75, 0.55)
x[:len(a)] += a
o = int(0.075 * SR)
x[o:o + len(b)] += b[:n - o]
# A tiny room, so it is soft rather than dry.
for d, g in ((0.031, 0.18), (0.047, 0.12), (0.071, 0.07)):
    k = int(d * SR)
    x[k:] += g * x[:-k]
f = int(0.06 * SR)
x[-f:] *= np.linspace(1, 0, f) ** 2
rms = np.sqrt(np.mean(x ** 2))
x *= 10 ** ((-20.3 - 20 * np.log10(rms)) / 20)
pk = np.abs(x).max()
print(f'0.42 s, RMS {20*np.log10(np.sqrt(np.mean(x**2))):.1f} dB, peak {20*np.log10(pk):.1f} dBFS')
pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
w = wave.open('out/equip-44k.wav', 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
