#!/usr/bin/env bash
# Generates tiny placeholder videos so the site runs before the real footage
# arrives. Running it again overwrites public/video, so don't run it after
# you've added the real files.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/video
mkdir -p "$OUT/previews"
FONT="$(fc-match -f '%{file}' 'DejaVu Sans:bold' 2>/dev/null || true)"
text() { [ -n "$FONT" ] && echo "drawtext=fontfile=$FONT:text='$1':fontcolor=white@0.8:fontsize=$2:x=(w-tw)/2:y=(h-th)/2" || echo null; }

ffmpeg -nostdin -hide_banner -loglevel error -y \
  -f lavfi -i "gradients=s=960x540:d=10:speed=0.02:c0=0x202830:c1=0x504038:c2=0x183028:n=3,format=yuv420p" \
  -vf "$(text 'SHOWREEL PLACEHOLDER' 36)" -an -c:v libx264 -crf 32 -movflags +faststart "$OUT/showreel.mp4"
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$OUT/showreel.mp4" -frames:v 1 "$OUT/showreel.jpg"

i=0
node -e "for (const f of require('fs').readdirSync('./src/data/projects')) console.log(require('./src/data/projects/' + f).slug)" | while read -r slug; do
  hue=$(( (i * 137) % 360 )); i=$((i + 1))
  ffmpeg -nostdin -hide_banner -loglevel error -y \
    -f lavfi -i "color=c=0x808080:s=640x360:d=3,format=yuv420p,hue=h=$hue:s=4,eq=brightness=-0.1" \
    -vf "$(text "$slug" 22)" -an -c:v libx264 -crf 34 -movflags +faststart "$OUT/previews/$slug.mp4"
done
du -sh "$OUT"
