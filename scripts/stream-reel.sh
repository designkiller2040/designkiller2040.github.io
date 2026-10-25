#!/usr/bin/env bash
# Runs first in the build. When Homepage > Showreel has a Cloudflare video
# ("stream" in src/data/home.json), copies that film's best quality into
# public/video/stream/reel.mp4 (not kept in git) and takes its first frame as
# public/video/stream/reel.jpg. The homepage then plays this file instead of
# the uploaded MP4. The film is copied as Cloudflare serves it, not re-encoded.
#
# Kept in .cache/reel/ by video, so each film is only read once. If the film
# can't be read, the build carries on with the uploaded MP4.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/video/stream"
CACHE="$ROOT/.cache/reel"
mkdir -p "$OUT" "$CACHE"
rm -f "$OUT"/reel.*

read -r url id < <(node -e '
  const home = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const s = (home.stream ?? "").trim();
  const id = s.match(/\b[0-9a-f]{32}\b/i)?.[0];
  if (id) {
    const host = s.match(/customer-[a-z0-9]+\.cloudflarestream\.com/i)?.[0] ?? "videodelivery.net";
    console.log(`https://${host}/${id}/manifest/video.m3u8 ${id}`);
  }
' "$ROOT/src/data/home.json")
[ -n "${id:-}" ] || exit 0

if [ ! -f "$CACHE/$id.mp4" ]; then
  echo "→ copying the showreel from Cloudflare ($id)"
  # ffmpeg picks the highest-resolution version of the film on its own.
  if ! ffmpeg -nostdin -hide_banner -loglevel error -y -i "$url" -an -c:v copy \
    -movflags +faststart "$CACHE/$id.tmp.mp4"; then
    echo "  couldn't read the showreel from Cloudflare, keeping the uploaded one"
    rm -f "$CACHE/$id.tmp.mp4"
    exit 0
  fi
  ffmpeg -nostdin -hide_banner -loglevel error -y -i "$CACHE/$id.tmp.mp4" -frames:v 1 -q:v 2 "$CACHE/$id.jpg"
  mv "$CACHE/$id.tmp.mp4" "$CACHE/$id.mp4"
fi
cp "$CACHE/$id.mp4" "$OUT/reel.mp4"
[ -f "$CACHE/$id.jpg" ] && cp "$CACHE/$id.jpg" "$OUT/reel.jpg"
echo "  showreel: $(du -h "$OUT/reel.mp4" | cut -f1)"
exit 0
