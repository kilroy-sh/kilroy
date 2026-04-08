#!/usr/bin/env bash
# Bump the plugin version across all manifests.
# Usage: ./scripts/bump-version.sh 0.7.0

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.7.0"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

FILES=(
  "$ROOT/plugin/.claude-plugin/plugin.json"
  "$ROOT/plugin/.codex-plugin/plugin.json"
  "$ROOT/.claude-plugin/marketplace.json"
)

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "SKIP (not found): $f"
    continue
  fi
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$f"
  echo "  OK: ${f#$ROOT/}"
done

echo ""
echo "Bumped to $VERSION"
