#!/bin/bash
# EQ (rumble cut, softer top), then loudness: master.sh LUFS name...
cd "$(dirname "$0")"
I=$1; shift
for k in "$@"; do
  ffmpeg -v error -y -i out/$k.wav -af "highpass=f=32,lowshelf=f=70:g=-3,highshelf=f=8500:g=-7,lowpass=f=15000,loudnorm=I=$I:TP=-1.0:LRA=9" -ar 44100 out/$k-m.wav && mv out/$k-m.wav out/$k.wav
done
