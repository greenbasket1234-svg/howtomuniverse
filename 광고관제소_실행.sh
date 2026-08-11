#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run build
npm run start
