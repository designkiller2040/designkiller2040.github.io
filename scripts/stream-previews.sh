#!/usr/bin/env bash
# Runs first in the build. For every project that has a Cloudflare Stream film
# but no uploaded hover clip, cuts a 3-second silent clip from the film into
# public/video/previews/auto/<slug>.mp4 (not kept in git). The project then
# uses it as its hover preview, and scripts/preview-frames.sh takes the big
# thumbnail from it, like an uploaded clip. "Auto preview starts at" in the
# editor picks the moment (default: the start of the film).
#
# Clips are kept in .cache/stream/ by video and start time, so each film is
# only read once. A film that can't be read is skipped; the build carries on.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/video/previews/auto"
CACHE="$ROOT/.cache/stream"
mkdir -p "$OUT" "$CACHE"
rm -f "$OUT"/*.mp4

# slug, Stream address, start (seconds) for each project that needs a clip.
node -e '
  const fs = require("fs");
  const dir = process.argv[1];
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const p = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
    if (p.preview || !p.stream) continue;
    const id = p.stream.match(/\b[0-9a-f]{32}\b/i)?.[0];
    if (!id) continue;
    const host = p.stream.match(/customer-[a-z0-9]+\.cloudflarestream\.com/i)?.[0] ?? "videodelivery.net";
    console.log([p.slug, `https://${host}/${id}/manifest/video.m3u8`, Math.max(0, Number(p.previewStart) || 0), id].join(" "));
  }
' "$ROOT/src/data/projects" | while read -r slug url start id; do
  key="$id-$start"
  if [ ! -f "$CACHE/$key.mp4" ]; then
    echo "→ cutting preview for $slug from its Cloudflare film (at ${start}s)"
    if ! ffmpeg -nostdin -hide_banner -loglevel error -y -ss "$start" -i "$url" -t 3 -an \
      -vf "scale=-2:'min(1080,ih)':flags=lanczos,format=yuv420p" \
      -c:v libx264 -preset medium -crf 20 -profile:v high -movflags +faststart \
      "$CACHE/$key.tmp.mp4"; then
      echo "  couldn't read the film for $slug, skipped"
      rm -f "$CACHE/$key.tmp.mp4"
      continue
    fi
    mv "$CACHE/$key.tmp.mp4" "$CACHE/$key.mp4"
  fi
  cp "$CACHE/$key.mp4" "$OUT/$slug.mp4"
  echo "  auto preview: $slug.mp4"
done
exit 0
