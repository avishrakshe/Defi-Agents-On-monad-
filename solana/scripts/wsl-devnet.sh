#!/usr/bin/env bash
# Run the seed script or the test suite against Solana devnet + the pinned MagicBlock devnet ER (WSL / Linux).
#   bash solana/scripts/wsl-devnet.sh /mnt/c/.../solana seed|test
set -uo pipefail
. ~/mbenv.sh
SRC="${1:?repo solana/ path}"
WHAT="${2:?seed|test}"
WORK="$HOME/agent-market"
rsync -a --exclude target --exclude node_modules --exclude .keys "$SRC/" "$WORK/"
mkdir -p "$WORK/.keys" && rsync -a "$SRC/.keys/" "$WORK/.keys/"
cd "$WORK"
[ -d node_modules ] || yarn install --silent --non-interactive >/dev/null 2>&1
export ER_REGION="${ER_REGION:-us}"
. ./scripts/devnet-env.sh
export AUTHORITY_KEYPAIR="$WORK/.keys/operator.json"
case "$WHAT" in
  seed) npx ts-node --transpile-only -P ./tsconfig.json scripts/seed.ts; CODE=$?; cp -f deployed.json "$SRC/deployed.json" 2>/dev/null ;;
  test) npx ts-mocha -p ./tsconfig.json -t 1000000 tests/agent-market.ts; CODE=$?; cp -f test-results-devnet.json "$SRC/test-results-devnet.json" 2>/dev/null ;;
esac
# Keep every generated keypair in the repo's git-ignored .keys/
rsync -a "$WORK/.keys/" "$SRC/.keys/"
exit $CODE
