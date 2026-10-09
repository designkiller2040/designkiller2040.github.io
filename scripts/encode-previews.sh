#!/usr/bin/env bash
# Re-encode a folder of source clips (up to 4K, any common format) into small,
# muted H.264 loops for the homepage hover previews.
#
#   ./scripts/encode-previews.sh ~/Desktop/previews-source
#
# Name each source file after its project slug, e.g. maana-homes.mov.
# Output goes to public/video/previews/<slug>.mp4.
#
# Options (environment variables):
#   HEIGHT=1080   output height in pixels (720 makes files about half the size)
#   CRF=26        quality: lower = better and bigger (23 to 30 is sensible)
#   CLIP_SECONDS=3  trim each clip to this length (0 = keep full length)
set -euo pipefail

SRC="${1:?Usage: $0 <folder of source clips>}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/video/previews"
HEIGHT="${HEIGHT:-1080}"
CRF="${CRF:-26}"
CLIP_SECONDS="${CLIP_SECONDS:-3}"
mkdir -p "$OUT"

shopt -s nullglob nocaseglob
for f in "$SRC"/*.{mp4,mov,m4v,mkv,webm,mxf}; do
  slug="$(basename "${f%.*}")"
  trim=(); [ "$CLIP_SECONDS" != "0" ] && trim=(-t "$CLIP_SECONDS")
  echo "→ $slug"
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$f" "${trim[@]}" \
    -an \
    -vf "scale=-2:'min($HEIGHT,ih)':flags=lanczos,fps=30,format=yuv420p" \
    -c:v libx264 -preset slow -crf "$CRF" -profile:v high \
    -movflags +faststart \
    "$OUT/$slug.mp4"
  ls -lh "$OUT/$slug.mp4" | awk '{print "  " $5}'
done
