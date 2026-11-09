#!/bin/sh
# Build the Chrome Web Store upload: only the files the extension loads, nothing from docs/ or store/.
set -e
cd "$(dirname "$0")/.."

version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)
out="dist/pile-$version.zip"

mkdir -p dist
rm -f "$out"
zip -qrX "$out" manifest.json background.js lib reader.html reader.css reader.js icons -x '*.DS_Store'
unzip -l "$out"
echo "→ $out"
