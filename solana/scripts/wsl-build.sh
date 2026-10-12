#!/usr/bin/env bash
# Build the Anchor program on the Linux filesystem (WSL) and copy results back into the repo.
#   bash solana/scripts/wsl-build.sh /mnt/c/.../solana
set -euo pipefail
. ~/mbenv.sh
SRC="${1:?repo solana/ path}"
WORK="$HOME/agent-market"
mkdir -p "$WORK"
rsync -a --delete --exclude target --exclude node_modules --exclude .keys --exclude test-ledger --exclude magicblock-test-storage "$SRC/" "$WORK/"

# Keep one program keypair forever: repo .keys/ is the source of truth (git-ignored)
mkdir -p "$WORK/target/deploy" "$SRC/.keys"
if [ -f "$SRC/.keys/agent_market-keypair.json" ]; then
  cp "$SRC/.keys/agent_market-keypair.json" "$WORK/target/deploy/agent_market-keypair.json"
elif [ ! -f "$WORK/target/deploy/agent_market-keypair.json" ]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$WORK/target/deploy/agent_market-keypair.json"
fi
cp "$WORK/target/deploy/agent_market-keypair.json" "$SRC/.keys/agent_market-keypair.json"

cd "$WORK"
anchor keys sync >/dev/null
anchor build 2>&1 | grep -vE "^\s*(Compiling|Downloaded|Downloading)" | tail -60
echo "PROGRAM_ID=$(solana-keygen pubkey target/deploy/agent_market-keypair.json)"

# Copy back what the repo needs: synced program id, IDL + TS types
cp programs/agent_market/src/lib.rs "$SRC/programs/agent_market/src/lib.rs"
cp Anchor.toml "$SRC/Anchor.toml"
mkdir -p "$SRC/idl"
cp target/idl/agent_market.json "$SRC/idl/agent_market.json"
cp target/types/agent_market.ts "$SRC/idl/agent_market.ts"
ls -la target/deploy/agent_market.so
