import subprocess, wave, numpy as np
SR=44100
def load(p):
    w=wave.open(p); x=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768
    return x.reshape(-1,2).T
def save(p,x):
    pcm=(np.clip(x.T,-1,1)*32767).astype('<i2'); w=wave.open(p,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
for k in 'ABD':
    for kind,target,limit in (('fanfare',-13.4,-0.8),('sting',-20.0,-3.0)):
        src=f'out/{k}-{kind}.wav'; eq=f'out/{k}-{kind}-eq.wav'
        subprocess.run(['ffmpeg','-v','error','-y','-i',src,'-af','highpass=f=32,lowshelf=f=70:g=-3,highshelf=f=8500:g=-7,lowpass=f=15000',eq],check=True)
        x=load(eq); m=np.abs(x).max(0)
        env=np.convolve(m,np.ones(441)/441,'same'); thr=env.max()*10**(-52/20)
        end=min(x.shape[1], np.nonzero(env>thr)[0][-1]+int(0.15*SR))
        x=x[:,:end]; f=int(0.25*SR); x[:,-f:]*=np.linspace(1,0,f)**2
        rms=20*np.log10(np.sqrt(np.mean(x**2))); x*=10**((target-rms)/20)
        lim=10**(limit/20); pk=np.abs(x).max()
        if pk>lim: x=np.tanh(x/lim*0.9)/np.tanh(0.9*pk/lim)*lim*min(1,pk/lim)/ (pk/lim) if False else lim*np.tanh(x/lim)
        save(f'out/{k}-{kind}.wav',x)
        r2=20*np.log10(np.sqrt(np.mean(x**2))); p2=20*np.log10(np.abs(x).max())
        print(f'{k}-{kind}: {x.shape[1]/SR:.2f}s RMS {r2:.1f} dB peak {p2:.1f} dBFS')
