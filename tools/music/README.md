# The game's own music

Everything the game plays as music was composed and synthesised here, note
by note, by Paper Ship Studio for Dice Battles. There are no samples and no
third-party sounds anywhere in it: every oscillator, drum, pluck and reverb is
code in `synth.py`, and every note is written in `tracks.py`. The rendered
files in `assets/sounds/` are the output of these scripts and nothing else, so
the soundtrack is reproducible from this folder and its authorship is on
record.

Marc, 5 Nov 2026: "Music should be fast paced and energetic and exciting and
owned completely by us so it needs to be original."

## What is in the game

| Script name | In the game | What it is |
| --- | --- | --- |
| `A` | `music-pixel.m4a`, `music-pixel-hot.m4a`, `fanfare-pixel.m4a` | Pixel Rush — chiptune, 160 BPM, 42.0 s loop |
| `B` | `music-brass.m4a`, `music-brass-hot.m4a`, `fanfare-brass.m4a` | Brass Chase — funk, 132 BPM, 50.9 s loop |
| `D` | `music-neon.m4a`, `music-neon-hot.m4a`, `fanfare-neon.m4a` | Neon Sprint — synth-pop, 150 BPM, 44.8 s loop |
| `L` | `music-lobby.m4a` | Pixel Rush slowed for the menus, 104 BPM, 64.6 s loop |
| `A-sting` | `startup.m4a` | The title-card sting |
| `purchase.py` | `purchase.m4a` | The purchase sound: a coin ding-ding, a glittering run up D major, a bell shimmer (1.6 s) |
| `cheer.py` | `cheer.m4a` | The rescue cheer: synthesised applause, a rising whistle and a short ta-da (1.7 s) |
| `equip.py` | `equip.wav` | The equip bloop: two rounded bubble pops sliding up to D5 and A5 (0.42 s, mono 22.05 kHz WAV, so it plays the instant it is tapped) |

`C` is a fourth track that was written and not chosen; the script still
renders it so nothing is lost.

A `-hot` file is the SAME piece with more layers, sample-for-sample the same
length and timing as its plain file, so the game can switch between the two
at the same playback position without a seam (`src/audio/sounds.ts`,
`setMusicIntensity`). `tracks.py` renders it as the `intense` kind.

## The files

- `synth.py` — the instrument. Band-limited oscillators built from sine
  partials, a plucked string (Karplus-Strong), drums made from sines and
  noise, a Schroeder reverb, and a mixer that wraps the reverb tail around
  to the start so every loop joins with no click.
- `tracks.py` — the music itself: chord tables, the note sequences and the
  arrangement of every track, and the `loop`, `intense`, `fanfare` and
  `sting` renders of each. Writes 44.1 kHz stereo WAV.
- `master.sh` — EQ (rumble cut, softer top) and loudness normalisation with
  ffmpeg's `loudnorm`, in place on the WAVs in `out/`.
- `oneshots.py` — the same EQ for the fanfares and stings, then trims the
  silent tail, adds a short fade and sets their level.
- `purchase.py` — the purchase sound, built from the same instrument
  (`python3 purchase.py`, writes `out/purchase.wav`).
- `cheer.py` — the rescue cheer, a crowd of synthesised claps with a
  whistle and a ta-da on top (`python3 cheer.py`, writes `out/cheer.wav`).
  It replaced a Creative Commons recording on 5 Nov 2026 so that nothing
  in the game needs crediting.
- `equip.py` — the bloop for putting on a die or a battlefield
  (`python3 equip.py`, writes `out/equip-44k.wav`; resample to mono
  22.05 kHz 16-bit for `assets/sounds/equip.wav`, the format the old one
  had, with `ffmpeg -i out/equip-44k.wav -ac 1 -ar 22050 -c:a pcm_s16le`).
- `analyse.py` — measures a rendered WAV: length, peak, tonal balance,
  loudness over time, how clean the loop seam is.

## Rendering it again

Needs only Python 3 with `numpy`, and `ffmpeg` on the path.

```sh
cd tools/music
python3 tracks.py out A B D L      # the three battle tracks and the lobby, as WAV
./master.sh -15 A A-intense B B-intense D D-intense   # first argument: target LUFS
./master.sh -18 L                  # the lobby sits quieter, under the menus
python3 oneshots.py                # the fanfares and stings
python3 analyse.py A A-intense L   # optional: check what came out
```

Then encode for the game as mono AAC, which is what the phone speaker hears
and what the download-size test expects (music at 64 kbps, the one-shots a
little higher):

```sh
ffmpeg -i out/A.wav -ac 1 -c:a aac -b:a 64k ../../assets/sounds/music-pixel.m4a
ffmpeg -i out/A-intense.wav -ac 1 -c:a aac -b:a 64k ../../assets/sounds/music-pixel-hot.m4a
ffmpeg -i out/A-fanfare.wav -ac 1 -c:a aac -b:a 96k ../../assets/sounds/fanfare-pixel.m4a
```

and the same for `B` (brass), `D` (neon), `L` (`music-lobby.m4a`) and
`A-sting` (`startup.m4a`). The synthesiser is seeded (`synth.py`, `rng`), so
a render is the same every time.

Retuning any of this is a release: the files ship with the JavaScript, so a
re-render goes out as an over-the-air update like any other change.
