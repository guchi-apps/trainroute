#!/usr/bin/env bash
#
# assets/*.svg から PWA 用のアイコンを書き出す。
#
# アイコンの原本は assets/ の3枚の SVG で、ここから出る PNG / ICO はすべて生成物。
# 図柄を直すときは SVG を直してこのスクリプトを流し、出力もまとめてコミットする
# （ビルド時には走らないため、コミットしないと本番へ出ない）。
#
#   ./scripts/generate-icons.sh
#
# 出力先は proxy の除外（src/proxy.ts の matcher）に合わせてある。除外に無いパスへ
# 移すと、未ログイン時にログイン画面の HTML が返り、MIME タイプ違いでインストールに失敗する。
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert が見つかりません。sudo apt install librsvg2-bin" >&2
  exit 1
fi

if command -v magick >/dev/null 2>&1; then
  im=(magick)
elif command -v convert >/dev/null 2>&1; then
  im=(convert)
else
  echo "ImageMagick が見つかりません。sudo apt install imagemagick" >&2
  exit 1
fi

mkdir -p public/icons

# manifest から参照する通常のアイコン。
rsvg-convert -w 192 -h 192 assets/icon.svg -o public/icons/icon-192.png
rsvg-convert -w 512 -h 512 assets/icon.svg -o public/icons/icon-512.png

# Android が端末ごとの形に切り抜くためのアイコン。
rsvg-convert -w 192 -h 192 assets/icon-maskable.svg -o public/icons/icon-maskable-192.png
rsvg-convert -w 512 -h 512 assets/icon-maskable.svg -o public/icons/icon-maskable-512.png

# iOS のホーム画面用。Next.js の apple-icon 規約で /apple-icon として配信される。
rsvg-convert -w 180 -h 180 assets/icon-apple.svg -o src/app/apple-icon.png

# ブラウザのタブ用。favicon.ico は app/ の直下にしか置けない。
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" assets/icon.svg -o "$tmp/favicon-$size.png"
done
"${im[@]}" "$tmp/favicon-16.png" "$tmp/favicon-32.png" "$tmp/favicon-48.png" src/app/favicon.ico

echo "書き出しました:"
echo "  public/icons/icon-192.png"
echo "  public/icons/icon-512.png"
echo "  public/icons/icon-maskable-192.png"
echo "  public/icons/icon-maskable-512.png"
echo "  src/app/apple-icon.png"
echo "  src/app/favicon.ico"
