# shellcheck shell=sh
# Solana devnet + one pinned MagicBlock devnet ER. Source, don't execute.
# ER_REGION: as | eu | us   (validator identities verified with getIdentity / router getRoutes on 2026-10-12)
ER_REGION="${ER_REGION:-as}"
case "$ER_REGION" in
  as) VALIDATOR=MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57 ;;
  eu) VALIDATOR=MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e ;;
  us) VALIDATOR=MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd ;;
esac
export NETWORK_LABEL=devnet
export VALIDATOR
export PROVIDER_ENDPOINT="${PROVIDER_ENDPOINT:-https://api.devnet.solana.com}"
export WS_ENDPOINT="${WS_ENDPOINT:-wss://api.devnet.solana.com}"
export EPHEMERAL_PROVIDER_ENDPOINT="https://devnet-$ER_REGION.magicblock.app"
export EPHEMERAL_WS_ENDPOINT="wss://devnet-$ER_REGION.magicblock.app"
export ANCHOR_PROVIDER_URL=$PROVIDER_ENDPOINT
export ANCHOR_WALLET="${HOME}/.config/solana/id.json"
# The market authority (= Mode A operator) — git-ignored
export AUTHORITY_KEYPAIR="${AUTHORITY_KEYPAIR:-$(cd "$(dirname "$0")" 2>/dev/null && pwd)/../.keys/operator.json}"
