# shellcheck shell=sh
# Local MagicBlock stack (mb-stack): base validator 8899, ER 7799 (via QFS 6699). Source, don't execute.
export NETWORK_LABEL=localnet
export PROVIDER_ENDPOINT=http://127.0.0.1:8899
export WS_ENDPOINT=ws://127.0.0.1:8900
export EPHEMERAL_PROVIDER_ENDPOINT=http://127.0.0.1:7799
export EPHEMERAL_WS_ENDPOINT=ws://127.0.0.1:7800
export VALIDATOR=mAGicPQYBMvcYveUZA5F5UNNwyHvfYh5xkLS2Fr1mev
export ANCHOR_PROVIDER_URL=$PROVIDER_ENDPOINT
export ANCHOR_WALLET="${HOME}/.config/solana/id.json"
export AUTHORITY_KEYPAIR="${HOME}/.config/solana/id.json"
