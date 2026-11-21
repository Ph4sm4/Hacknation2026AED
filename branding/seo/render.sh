#!/bin/sh
# Rasterises the SEO / PWA images into frontend/public (macOS `sips`, no extra dependencies).
#   sh branding/seo/render.sh
set -e
cd "$(dirname "$0")"
OUT=../../frontend/public
sips -s format png og-image.svg --out "$OUT/og-image.png" >/dev/null
sips -s format png icon.svg --out "$OUT/icon-512.png" >/dev/null
for s in 192 180 48; do
  sips -z "$s" "$s" "$OUT/icon-512.png" --out "$OUT/icon-$s.png" >/dev/null
done
mv "$OUT/icon-180.png" "$OUT/apple-touch-icon.png"
mv "$OUT/icon-48.png" "$OUT/favicon-48.png"
echo "done: og-image.png, icon-512.png, icon-192.png, apple-touch-icon.png, favicon-48.png"
