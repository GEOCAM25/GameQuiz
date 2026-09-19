#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Instala Node.js 22 o superior desde https://nodejs.org y vuelve a abrir este archivo."
  exit 1
fi
exec node server.mjs
