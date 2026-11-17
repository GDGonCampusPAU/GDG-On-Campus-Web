#!/usr/bin/env bash
# design folders/fonts içindeki TTF kaynaklarından Latin + Türkçe alt kümeli WOFF2 üretir.
# Gereksinim: pip install fonttools brotli   (pyftsubset komutu)
# Kullanım:   bash scripts/build-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="design folders/fonts"
# Latin-1 + Türkçe harfler + tipografik noktalama + € (dev dalındaki fontlarla aynı aralık)
UNICODES="U+0020-007E,U+00A0-00FF,U+011E-011F,U+0130-0131,U+015E-015F,U+2013-2014,U+2018-201A,U+201C-201D,U+2026,U+20AC"
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
