"""
A small synthesizer for Dice Battles' own music. Everything here is written
for the game: band-limited oscillators built from sine partials, a plucked
string (Karplus-Strong), drums made from sines and noise, a Schroeder
reverb, and a mixer that wraps the reverb tail so every track loops with no
seam. No samples, no third-party sounds: the output is entirely our own.
"""
import numpy as np

SR = 44100
rng = np.random.default_rng(20261105)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


# ---------------------------------------------------------------- envelopes
def adsr(n, a=0.005, d=0.1, s=0.7, r=0.05, gate=None):
    """Attack/decay/sustain over `gate` seconds, then release; n samples total."""
    t = np.arange(n) / SR
    gate = n / SR - r if gate is None else gate
    env = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = t > gate
    if rel.any():
        at_gate = env[np.argmax(rel)] if rel.any() else s
        env = np.where(rel, at_gate * np.exp(-(t - gate) / max(r / 4, 1e-6)), env)
    return env


# -------------------------------------------------------------- oscillators
def additive(freq, n, shape='saw', bright=None, detune_cents=0.0, vib=None, phase=0.0):
    """Band-limited wave from partials. `bright(t)` >= 0 dims the upper partials
    over time like a closing filter (0 = full brightness)."""
    t = np.arange(n) / SR
    f = freq * 2 ** (detune_cents / 1200.0)
    if vib is not None:
        rate, depth, delay = vib
        lfo = 1 + (2 ** (depth / 1200.0) - 1) * np.sin(2 * np.pi * rate * t) * np.clip((t - delay) / 0.15, 0, 1)
        ph = 2 * np.pi * np.cumsum(f * lfo) / SR + phase
    else:
        ph = 2 * np.pi * f * t + phase
    kmax = int(min(48, (SR / 2 - 200) // max(f, 1)))
    out = np.zeros(n)
    tilt = bright(t) if bright is not None else None
    for k in range(1, kmax + 1):
        if shape == 'saw':
            a = 1.0 / k
        elif shape == 'square':
            if k % 2 == 0:
                continue
            a = 1.0 / k
        elif shape.startswith('pulse'):
            duty = float(shape[5:]) if len(shape) > 5 else 0.25
            a = abs(np.sin(np.pi * k * duty)) / k
            if a < 1e-4:
                continue
        elif shape == 'tri':
            if k % 2 == 0:
                continue
            a = 1.0 / (k * k)
        elif shape == 'sine':
            if k > 1:
                break
            a = 1.0
        else:
            raise ValueError(shape)
        w = a * np.exp(-(k - 1) * tilt) if tilt is not None else a
        out += w * np.sin(k * ph)
    return out


def supersaw(freq, n, voices=5, spread=18.0, bright=None):
    out = np.zeros(n)
    for i in range(voices):
        c = (i - (voices - 1) / 2) / max(1, (voices - 1) / 2) * spread
        out += additive(freq, n, 'saw', bright=bright, detune_cents=c, phase=rng.uniform(0, 6.28))
    return out / voices


def pluck(freq, n, damp=0.996, bright=0.5):
    """Karplus-Strong string, computed a period at a time."""
    N = max(2, int(round(SR / freq)))
    # One leading zero, so the first period's "previous sample" exists.
    y = np.zeros(n + N + 2)
    burst = rng.uniform(-1, 1, N)
    # A darker pick: blend the burst with its own smoothing.
    sm = np.convolve(burst, np.ones(3) / 3, mode='same')
    y[1:N + 1] = bright * burst + (1 - bright) * sm
    s = N + 1
    while s < n + 1:
        e = min(s + N, n + 1)
        m = e - s
        y[s:e] = damp * 0.5 * (y[s - N:s - N + m] + y[s - N - 1:s - N - 1 + m])
        s = e
    return y[1:n + 1]


# -------------------------------------------------------------------- drums
def noise(n):
    return rng.uniform(-1, 1, n)


def hp(x, amount=1.0):
    """A crude high-pass: the signal minus its smoothing."""
    sm = np.convolve(x, np.ones(4) / 4, mode='same')
    return x - amount * sm


def lp(x, width=4):
    return np.convolve(x, np.ones(width) / width, mode='same')


def kick(punch=1.0, length=0.35, low=48.0, high=150.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    low = max(low, 58.0)
    f = low + (high - low) * np.exp(-t * 32)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    click = lp(noise(n), 6) * np.exp(-t * 300) * 0.25 * punch
    return np.tanh(1.6 * (body + click)) * 0.95


def snare(length=0.25, tone=185.0, snap=1.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 22) * 0.55
    rattle = lp(hp(noise(n)), 3) * np.exp(-t * 16) * 1.2 * snap
    return body + rattle


def clap(length=0.3):
    n = int(length * SR)
    t = np.arange(n) / SR
    env = np.zeros(n)
    for d in (0.0, 0.009, 0.019):
        env += np.where(t >= d, np.exp(-(t - d) * 120), 0)
    env += np.where(t >= 0.028, np.exp(-(t - 0.028) * 14) * 0.6, 0)
    return lp(hp(noise(n)), 3) * env * 0.9


def hat(open_=False, length=None):
    length = length or (0.35 if open_ else 0.06)
    n = int(length * SR)
    t = np.arange(n) / SR
    x = lp(hp(hp(noise(n))), 3)
    return x * np.exp(-t * (9 if open_ else 70)) * (0.3 if open_ else 0.26)


def crash(length=1.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    return lp(hp(hp(noise(n))), 3) * np.exp(-t * 2.4) * 0.25


def tom(m, length=0.3):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = hz(m) * (1 + 0.6 * np.exp(-t * 25))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.8


def chip_noise_drum(kind, length=0.12):
    """8-bit style: stepped noise for the chiptune kit."""
    n = int(length * SR)
    t = np.arange(n) / SR
    step = 8 if kind == 'snare' else 3
    raw = noise(n // step + 1).repeat(step)[:n]
    rate = 22 if kind == 'snare' else 60
    return lp(np.sign(raw), 2) * np.exp(-t * rate) * (0.45 if kind == 'snare' else 0.15)


# ----------------------------------------------------------------- effects
def _comb(x, D, g):
    y = np.zeros(len(x) + D)
    y[:len(x)] = x
    s = D
    while s < len(y):
        e = min(s + D, len(y))
        y[s:e] += g * y[s - D:e - D]
        s = e
    return y[:len(x)]


def _allpass(x, D, g):
    y = np.zeros(len(x))
    xp = np.concatenate([np.zeros(D), x])
    yp = np.zeros(len(x) + D)
    s = 0
    while s < len(x):
        e = min(s + D, len(x))
        yp[D + s:D + e] = -g * x[s:e] + xp[s:e] + g * yp[s:e]
        s = e
    y = yp[D:]
    return y


def reverb(x, size=1.0, damp=3):
    combs = [1557, 1617, 1491, 1422]
    out = np.zeros(len(x))
    for D in combs:
        out += _comb(lp(x, damp), int(D * size), 0.77)
    out /= len(combs)
    for D in (225, 556):
        out = _allpass(out, D, 0.5)
    return out


def delay(x, seconds, fb=0.35, mix=0.3):
    D = int(seconds * SR)
    return _comb(x, D, fb) * mix


# ------------------------------------------------------------------- mixer
class Mix:
    """Stereo buses; place(sound, at_seconds, pan, bus). Loops by wrapping."""

    def __init__(self, seconds, tail=3.0):
        self.length = int(round(seconds * SR))
        self.n = self.length + int(tail * SR)
        self.buses = {}

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((2, self.n))
        return self.buses[name]

    def place(self, sound, at, pan=0.0, bus='main', gain=1.0):
        b = self.bus(bus)
        i = int(round(at * SR))
        if i >= self.n:
            return
        m = min(len(sound), self.n - i)
        l = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
        r = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2) * gain
        b[0, i:i + m] += sound[:m] * l
        b[1, i:i + m] += sound[:m] * r

    def render(self, sends, pump=None, loop=True):
        """sends: {bus: (gain, reverb_send)}. pump: (beat_seconds, depth, buses).
        loop=False: a one-shot (fanfare, sting): the whole tail, faded out."""
        dry = np.zeros((2, self.n))
        wet_in = np.zeros(self.n)
        for name, b in self.buses.items():
            g, rs = sends.get(name, (1.0, 0.0))
            bb = b * g
            if pump and name in pump[2]:
                beat, depth = pump[0], pump[1]
                t = np.arange(self.n) / SR
                ph = (t % beat) / beat
                bb = bb * (1 - depth * np.exp(-ph * 9))
            dry += bb
            wet_in += rs * (bb[0] + bb[1]) / 2
        if wet_in.any():
            w = reverb(wet_in)
            dry[0] += w
            dry[1] += np.roll(w, 300)
        if not loop:
            fade = np.ones(self.n)
            k = int(0.4 * SR)
            fade[-k:] = np.linspace(1, 0, k) ** 2
            return dry * fade
        # Wrap the tail over the start, so the loop point is seamless.
        out = dry[:, :self.length].copy()
        tail = dry[:, self.length:]
        k = min(tail.shape[1], self.length)
        out[:, :k] += tail[:, :k]
        return out


def master(x, drive=1.15):
    x = x / (np.max(np.abs(x)) + 1e-9)
    return np.tanh(drive * x) / np.tanh(drive)
