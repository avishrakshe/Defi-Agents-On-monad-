#!/usr/bin/env bash
# Deploy (or upgrade) agent_market on Solana devnet from the last WSL build, then fund the market operator.
#   bash solana/scripts/wsl-deploy-devnet.sh /mnt/c/.../solana
set -euo pipefail
. ~/mbenv.sh
SRC="${1:?repo solana/ path}"
WORK="$HOME/agent-market"
URL="${DEVNET_RPC:-https://api.devnet.solana.com}"
cd "$WORK"
echo "deployer $(solana-keygen pubkey ~/.config/solana/id.json): $(solana balance --url $URL)"
solana program deploy target/deploy/agent_market.so --program-id target/deploy/agent_market-keypair.json \
  --url "$URL" --with-compute-unit-price 50000 --max-sign-attempts 30 2>&1 | tail -3
solana program show "$(solana-keygen pubkey target/deploy/agent_market-keypair.json)" --url "$URL" | head -8

# Market authority / Mode A operator key (git-ignored)
OP="$SRC/.keys/operator.json"
[ -f "$OP" ] || solana-keygen new --no-bip39-passphrase --silent --outfile "$OP"
OPK=$(solana-keygen pubkey "$OP")
BAL=$(solana balance "$OPK" --url "$URL" | awk '{print $1}')
awk "BEGIN{exit !($BAL < 2)}" && solana transfer "$OPK" 2.5 --allow-unfunded-recipient --url "$URL" --fee-payer ~/.config/solana/id.json >/dev/null
echo "operator $OPK: $(solana balance $OPK --url $URL)"
echo "deployer left: $(solana balance --url $URL)"
