import sys, wave, numpy as np
SR=44100
def load(p):
    w=wave.open(p); x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768
    return x.reshape(-1,w.getnchannels()).T
def bands(m):
    n=1<<15; segs=[m[i:i+n] for i in range(0,len(m)-n,n)]
    P=np.mean([np.abs(np.fft.rfft(s*np.hanning(n)))**2 for s in segs],axis=0); f=np.fft.rfftfreq(n,1/SR)
    edges=[20,60,250,2000,6000,12000,20000]; tot=P[(f>20)].sum()
    return [10*np.log10(P[(f>=a)&(f<b)].sum()/tot+1e-12) for a,b in zip(edges,edges[1:])]
for name in sys.argv[1:]:
    x=load(f'out/{name}.wav'); m=x.mean(0)
    win=int(SR*1.0); rms=[20*np.log10(np.sqrt(np.mean(m[i:i+win]**2))+1e-9) for i in range(0,len(m)-win,win)]
    seam=np.abs(np.concatenate([m[-200:],m[:200]])); jump=abs(m[0]-m[-1])
    dif=np.max(np.abs(np.diff(m)))
    print(f"{name}: len {len(m)/SR:.1f}s peak {np.max(np.abs(x)):.2f} | bands sub/low/mid/pres/high/air dB "+" ".join(f"{b:6.1f}" for b in bands(m)))
    print(f"    per-second RMS dB min {min(rms):.1f} max {max(rms):.1f} median {np.median(rms):.1f}; loop jump {jump:.3f}; max step {dif:.3f}; stereo corr {np.corrcoef(x[0],x[1])[0,1]:.2f}")
