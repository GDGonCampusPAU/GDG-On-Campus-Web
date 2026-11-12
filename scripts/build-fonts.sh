#!/usr/bin/env bash
# design folders/fonts içindeki TTF kaynaklarından Latin + Türkçe alt kümeli WOFF2 üretir.
# Gereksinim: pip install fonttools brotli   (pyftsubset komutu)
# Kullanım:   bash scripts/build-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="design folders/fonts"
# Latin-1, Latin Extended-A (Türkçe dahil), genel noktalama, €, ₺, ™, oklar, −, ≈
UNICODES="U+0000-00FF,U+0100-017F,U+2000-206F,U+20AC,U+20BA,U+2122,U+2190-2193,U+2212,U+2248"
build() { # build <hedef dizin> <font adı>...
  local out="$1"; shift
  for name in "$@"; do
    pyftsubset "$SRC/$name.ttf" --unicodes="$UNICODES" --layout-features='*' \
      --flavor=woff2 --output-file="$out/$name.woff2"
    echo "$out/$name.woff2"
  done
}
build frontend/public/fonts GoogleSans-Regular GoogleSans-Medium GoogleSans-Bold GoogleSansMono-Regular GoogleSansMono-Medium
build frontend/hackaton/public/fonts GoogleSans-Regular GoogleSans-Bold GoogleSansMono-Regular GoogleSansMono-Bold
