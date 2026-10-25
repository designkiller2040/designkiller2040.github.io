#!/usr/bin/env bash
# Runs after `astro build`. Preview clips uploaded in the editor can be any
# common video file (.mov, ProRes, HEVC...), but most browsers only play H.264
# MP4. This turns every preview that isn't one into a 1080p, muted H.264 MP4
# in dist/ (the site links to the .mp4 name, see previewSrc in
# src/data/projects.ts). The uploaded original stays as it is in public/.
#
# Converted files are kept in .cache/previews/ by content, so each clip is only
# converted once (the deploy workflow saves that folder between runs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="$ROOT/.cache/previews"
mkdir -p "$CACHE"

shopt -s nullglob nocaseglob
# Clips can sit in the previews folder or in the editor's Global Assets folder.
for f in "$ROOT"/public/{video/previews,images/uploads}/*.{mp4,mov,m4v,mkv,webm,mxf}; do
  rel="${f#"$ROOT"/public/}"
  OUT="$ROOT/dist/$(dirname "$rel")"
  name="$(basename "$f")"
  base="${name%.*}"
  ext="${name##*.}"
  codec="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "$f" || true)"
  if [ "${ext,,}" = "mp4" ] && [ "$codec" = "h264" ]; then continue; fi

  key="$(md5sum "$f" | cut -c1-16)"
  if [ ! -f "$CACHE/$key.mp4" ]; then
    echo "→ converting $name ($codec)"
    ffmpeg -nostdin -hide_banner -loglevel error -y -i "$f" -an \
      -vf "scale=-2:'min(1080,ih)':flags=lanczos,format=yuv420p" \
      -c:v libx264 -preset medium -crf 20 -profile:v high \
      -movflags +faststart \
      "$CACHE/$key.tmp.mp4"
    mv "$CACHE/$key.tmp.mp4" "$CACHE/$key.mp4"
  fi
  # Swap the original for the converted clip in the built site.
  rm -f "$OUT/$name"
  cp "$CACHE/$key.mp4" "$OUT/$base.mp4"
  echo "  $name → $base.mp4 ($(du -h "$OUT/$base.mp4" | cut -f1))"
done
