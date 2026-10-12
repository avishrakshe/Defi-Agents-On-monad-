#!/usr/bin/env bash
# Run tests/agent-market.ts against a local MagicBlock stack (WSL / Linux).
#   bash solana/scripts/wsl-test-local.sh /mnt/c/.../solana
set -uo pipefail
. ~/mbenv.sh
SRC="${1:?repo solana/ path}"
WORK="$HOME/agent-market"
MBV="${MB_VALIDATOR_VERSION:-0.14.10}"
rsync -a --exclude target --exclude node_modules --exclude test-ledger --exclude magicblock-test-storage "$SRC/" "$WORK/"
cd "$WORK"
command -v mb-stack >/dev/null && mb-stack --version 2>/dev/null | grep -q "$MBV" || npm i -g "@magicblock-labs/ephemeral-validator@$MBV" >/dev/null 2>&1
echo "mb-stack: $(command -v mb-stack)"
[ -d node_modules ] || yarn install --silent --non-interactive >/dev/null 2>&1
solana config set --url localhost >/dev/null

VALIDATOR_ACCT="$HOME/mb-examples/scripts/mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev.json"
WALLET=$(solana-keygen pubkey ~/.config/solana/id.json)
pkill -f mb-stack 2>/dev/null; pkill -f solana-test-validator 2>/dev/null; pkill -f ephemeral-validator 2>/dev/null; sleep 1
rm -rf ./magicblock-test-storage
RUST_LOG=info mb-stack --reset \
  --account mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev "$VALIDATOR_ACCT" \
  --upgradeable-program target/deploy/agent_market-keypair.json target/deploy/agent_market.so "$WALLET" \
  --url https://api.devnet.solana.com \
  --clone-upgradeable-program ComtrB2KEaWgXsW1dhr1xYL4Ht4Bjj3gXnnL6KMdABq \
  --clone noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV \
  > ./mb-stack.log 2>&1 < /dev/null &
STACK=$!
trap 'kill -TERM $STACK 2>/dev/null; sleep 1; pkill -f mb-stack; pkill -f solana-test-validator; pkill -f ephemeral-validator; pkill -f query-filtering' EXIT
for i in $(seq 1 180); do
  grep -q "MagicBlock stack is ready" ./mb-stack.log 2>/dev/null && break
  kill -0 $STACK 2>/dev/null || { echo "mb-stack exited"; tail -60 ./mb-stack.log; exit 1; }
  sleep 1
done
grep -q "MagicBlock stack is ready" ./mb-stack.log || { echo "mb-stack not ready"; tail -60 ./mb-stack.log; exit 1; }
echo "stack ready after ${i}s"
solana airdrop 100 "$WALLET" --url http://127.0.0.1:8899 >/dev/null
. ./scripts/local-env.sh
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/agent-market.ts 2>&1
CODE=$?
cp -f test-results-localnet.json "$SRC/test-results-localnet.json" 2>/dev/null
echo "--- mb-stack WARN/ERROR (last 30)"; perl -pe 's/\e\[[0-9;]*m//g' ./mb-stack.log | grep -iE "error|warn" | tail -30 | cut -c1-600
# Explain any failed committor transactions while the base validator is still up
for sig in $(perl -pe 's/\e\[[0-9;]*m//g' ./mb-stack.log | grep -oE "(SentTransactionError\([A-Za-z]+, |Some\()[1-9A-HJ-NP-Za-km-z]{80,90}" | grep -oE "[1-9A-HJ-NP-Za-km-z]{80,90}" | sort -u | head -3); do
  echo "--- base tx $sig"; solana confirm -v "$sig" --url http://127.0.0.1:8899 2>&1 | grep -E "Program (log|AZox|DELeG|Tokenkeg)|Error|failed|Status" | grep -v "^\s*Account" | head -60
done
exit $CODE
