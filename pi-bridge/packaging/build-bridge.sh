#!/usr/bin/env bash
# Builds the bridge as a folder that runs on its own: packaging/dist/bridge/
#   server.mjs   the bridge code, bundled (the packages stay in node_modules)
#   node_modules production dependencies only
#   node         a copy of the Node runtime used to run the bridge
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/dist/bridge"
UNDICI_VERSION="$(node -p "require('$HERE/../package.json').dependencies?.undici ?? '8.9.0'" 2>/dev/null || echo 8.9.0)"

rm -rf "$OUT"
mkdir -p "$OUT"

# 1. Bundle the TypeScript into one ES module. undici stays external: the Pi SDK imports it.
npx esbuild "$HERE/../server.ts" --bundle --platform=node --format=esm \
  --packages=external --external:undici --outfile="$OUT/server.mjs"

# 2. Production dependencies only, from the same lock file as development
cp "$HERE/../package.json" "$HERE/../package-lock.json" "$OUT/"
(cd "$OUT" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund)

# 3. undici must sit at the top level, because the bundled code imports it from here
(cd "$OUT" && npm install --omit=dev --no-save --ignore-scripts --no-audit --no-fund "undici@$UNDICI_VERSION")

# 4. The Node runtime that runs the bridge
cp "$(command -v node)" "$OUT/node"
echo "bridge built in $OUT"
