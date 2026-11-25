"""Puts a rendered reel together into an App Store video.

    python3 tools/trailer/compose.py FRAMES OUT.mp4 [--audio MUSIC] [--still PNG --still-at SECONDS]

FRAMES is the folder shoot.js wrote, with its manifest.json: the shots in
order, the crossfade between them and the crossfade that closes the
loop. Nothing is cut hard: Apple asks for no quick cuts, and both the
header and the previews play on a loop, so the tail is crossfaded into
the head and the last frame flows into the first.

The loop works like this. The reel is rendered L frames LONGER than the
video. The video starts L frames in; its last L frames are the reel's
tail fading into the reel's first L frames, which are exactly the ones
the video skipped — so after its last frame the video's first frame is
simply the next one. For the header, whose dice and camera repeat every
10 seconds, the two halves of that fade are the same picture except for
the few things that are not periodic (embers, mist, water), which is
what the fade is there to hide.

Encoding is fixed per reel, to what App Store Connect accepts:
  header        3840x1646, H.264 High 5.1, yuv420p, 30 fps, no audio
  iphone / ipad H.264 High 4.0, yuv420p, 30 fps, ~11 Mb/s, and a stereo
                AAC-LC 256 kb/s 44.1 kHz track (the game's own music)
Everything is tagged BT.709 and MP4 faststart.
"""
import argparse
import json
import os
import subprocess
import sys
from functools import lru_cache

import numpy as np
from PIL import Image

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')

ap = argparse.ArgumentParser()
ap.add_argument('frames')
ap.add_argument('out')
ap.add_argument('--audio', help='music for the previews (assets/sounds/music-*.m4a)')
ap.add_argument('--still', help='also save one frame of the video as a PNG')
ap.add_argument('--still-at', type=float, default=3.0, help='which second, for --still')
args = ap.parse_args()

man = json.load(open(os.path.join(args.frames, 'manifest.json')))
fps = man['fps']
fade = round(man['fade'] * fps)
loop = round(man['loopFade'] * fps)
reel = man['reel']


def path(n):
    return os.path.join(args.frames, f'f{n:05d}.png')


# The reel as a list of recipes: each frame is a weighted mix of
# rendered frames ({frame number: weight}).
reelFrames = []
for k, s in enumerate(man['shots']):
    own = [{s['first'] + j: 1.0} for j in range(s['count'])]
    if k == 0 or fade == 0:
        reelFrames += own
        continue
    # Crossfade: the previous shot's last `fade` frames under this one's first.
    tail = reelFrames[-fade:]
    del reelFrames[-fade:]
    for j in range(fade):
        a = (j + 1) / (fade + 1)
        mix = {n: w * (1 - a) for n, w in tail[j].items()}
        for n, w in own[j].items():
            mix[n] = mix.get(n, 0) + w * a
        reelFrames.append(mix)
    reelFrames += own[fade:]

T = len(reelFrames)
N = T - loop
video = []
for i in range(N):
    head = reelFrames[i + loop]
    if i < N - loop:
        video.append(head)
        continue
    a = (i - (N - loop) + 1) / (loop + 1)
    mix = {n: w * (1 - a) for n, w in head.items()}
    for n, w in reelFrames[i - (N - loop)].items():
        mix[n] = mix.get(n, 0) + w * a
    video.append(mix)

w, h = Image.open(path(0)).size
print(f'{reel}: {len(video)} frames ({len(video) / fps:.2f} s) at {w}x{h}', file=sys.stderr)


@lru_cache(maxsize=24)
def load(n):
    return np.asarray(Image.open(path(n)).convert('RGB'), dtype=np.float32)


def render(recipe):
    acc = np.zeros((h, w, 3), np.float32)
    for n, wt in recipe.items():
        acc += load(n) * wt
    return np.clip(acc + 0.5, 0, 255).astype(np.uint8)


if args.still:
    Image.fromarray(render(video[round(args.still_at * fps)]), 'RGB').save(args.still)

secs = len(video) / fps
cmd = [FFMPEG, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
       '-s', f'{w}x{h}', '-framerate', str(fps), '-i', '-']
if args.audio:
    cmd += ['-i', args.audio]
cmd += ['-map', '0:v']
# RGB to BT.709 limited-range YUV, tagged as such, so the colours match the PNGs.
vf = 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'
cmd += ['-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
        '-r', str(fps), '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-color_range', 'tv', '-preset', 'slow']
if reel == 'header':
    cmd += ['-level:v', '5.1', '-crf', '20', '-maxrate', '40M', '-bufsize', '80M', '-an']
else:
    cmd += ['-level:v', '4.0', '-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M',
            '-x264-params', 'keyint=60:min-keyint=30']
    if args.audio:
        # The game's music, faded out at the very end so the loop does not
        # click. The tracks are mono, so both channels carry it; mid/side
        # coding is off because with an empty side channel the encoder
        # spends ~205 kb/s, not the 256 kb/s Apple's spec asks for.
        cmd += ['-map', '1:a', '-af',
                f'atrim=0:{secs:.3f},afade=t=in:d=0.03,afade=t=out:st={secs - 0.8:.3f}:d=0.8,'
                'pan=stereo|c0=c0|c1=c0,aresample=44100',
                '-c:a', 'aac', '-aac_ms', '0', '-b:a', '256k', '-ar', '44100', '-ac', '2',
                '-t', f'{secs:.3f}']
cmd += ['-movflags', '+faststart', args.out]

ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for i, recipe in enumerate(video):
    ff.stdin.write(render(recipe).tobytes())
    if i % 60 == 0:
        print(f'  {i}/{len(video)}', file=sys.stderr)
ff.stdin.close()
sys.exit(ff.wait())
