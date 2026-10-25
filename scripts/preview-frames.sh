#!/usr/bin/env bash
# Runs before `astro build` (after scripts/stream-previews.sh). Saves the frame at 1 second of every HD preview
# clip as a JPG in public/images/frames/<clip name>.jpg (not kept in git).
# A project page uses that frame as its big thumbnail when it exists (see
# posterSrc in src/data/projects.ts); projects that only have the old small
# placeholder clips keep their "Big thumbnail" image.
#
# Frames are kept in .cache/frames/ by content, so each clip is only read once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/images/frames"
CACHE="$ROOT/.cache/frames"
mkdir -p "$OUT" "$CACHE"
rm -f "$OUT"/*.jpg

shopt -s nullglob nocaseglob
for f in "$ROOT"/public/{video/previews,video/previews/auto,images/uploads}/*.{mp4,mov,m4v,mkv,webm,mxf}; do
  name="$(basename "$f")"
  height="$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$f" || echo 0)"
  [ "${height:-0}" -ge 720 ] || continue

  key="$(md5sum "$f" | cut -c1-16)"
  if [ ! -f "$CACHE/$key.jpg" ]; then
    duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" || echo 0)"
    at="$(awk -v d="${duration:-0}" 'BEGIN { print (d > 2 ? 1 : d / 2) }')"
    ffmpeg -nostdin -hide_banner -loglevel error -y -ss "$at" -i "$f" -frames:v 1 \
      -vf "scale='min(2560,iw)':-2:flags=lanczos" -q:v 3 "$CACHE/$key.tmp.jpg"
    mv "$CACHE/$key.tmp.jpg" "$CACHE/$key.jpg"
  fi
  cp "$CACHE/$key.jpg" "$OUT/${name%.*}.jpg"
  echo "  frame: ${name%.*}.jpg"
done
