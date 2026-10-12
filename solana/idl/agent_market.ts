/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/agent_market.json`.
 */
export type AgentMarket = {
  "address": "AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu",
  "metadata": {
    "name": "agentMarket",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "x402-style pay-per-call for AI agents on MagicBlock Ephemeral Rollups"
  },
  "instructions": [
    {
      "name": "checkpoint",
      "docs": [
        "Commit AgentStats (+ any Tabs) to base through the delegated Ledger and the validator's magic_fee_vault,",
        "and attach one `payout` Magic Action per agent. remaining_accounts = [stats, profile] × agent_count, then tabs.",
        "Permissionless (so a crank can call it) but rate-limited; the config authority can force it."
      ],
      "discriminator": [
        213,
        200,
        19,
        204,
        240,
        143,
        184,
        252
      ],
      "accounts": [
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "magicFeeVault",
          "writable": true
        },
        {
          "name": "programId",
          "address": "AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu"
        },
        {
          "name": "caller",
          "docs": [
            "Optional: the config authority forces a checkpoint; without it the call is rate-limited"
          ],
          "signer": true,
          "optional": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentCount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeTab",
      "docs": [
        "After undelegation: return the unspent balance and close the Tab."
      ],
      "discriminator": [
        50,
        190,
        117,
        26,
        0,
        101,
        166,
        239
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true,
          "relations": [
            "tab"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "client"
              }
            ]
          }
        },
        {
          "name": "clientToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "delegateAgentStats",
      "discriminator": [
        208,
        184,
        164,
        193,
        241,
        76,
        25,
        170
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bufferAgentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "agentStats"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                142,
                32,
                219,
                0,
                0,
                237,
                180,
                105,
                244,
                199,
                205,
                102,
                158,
                224,
                216,
                112,
                213,
                237,
                76,
                5,
                142,
                8,
                132,
                41,
                51,
                51,
                19,
                61,
                28,
                144,
                119,
                28
              ]
            }
          }
        },
        {
          "name": "delegationRecordAgentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "agentStats"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataAgentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "agentStats"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "agentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "validator"
        },
        {
          "name": "ownerProgram",
          "address": "AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "delegateLedger",
      "discriminator": [
        159,
        3,
        197,
        64,
        7,
        12,
        101,
        66
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bufferLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                142,
                32,
                219,
                0,
                0,
                237,
                180,
                105,
                244,
                199,
                205,
                102,
                158,
                224,
                216,
                112,
                213,
                237,
                76,
                5,
                142,
                8,
                132,
                41,
                51,
                51,
                19,
                61,
                28,
                144,
                119,
                28
              ]
            }
          }
        },
        {
          "name": "delegationRecordLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataLedger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "validator"
        },
        {
          "name": "ownerProgram",
          "address": "AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateTab",
      "discriminator": [
        114,
        188,
        44,
        14,
        157,
        147,
        226,
        132
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "bufferTab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "tab"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                142,
                32,
                219,
                0,
                0,
                237,
                180,
                105,
                244,
                199,
                205,
                102,
                158,
                224,
                216,
                112,
                213,
                237,
                76,
                5,
                142,
                8,
                132,
                41,
                51,
                51,
                19,
                61,
                28,
                144,
                119,
                28
              ]
            }
          }
        },
        {
          "name": "delegationRecordTab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "tab"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataTab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "tab"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "client"
              }
            ]
          }
        },
        {
          "name": "validator"
        },
        {
          "name": "ownerProgram",
          "address": "AZox8uQ1sjG5KdorG4Y72w3tDT7eowJtxHdQRqMjUXVu"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "discardReceipt",
      "docs": [
        "The client gives up reviewing a call: closes its receipt so the ER rent returns to the Tab."
      ],
      "discriminator": [
        252,
        185,
        142,
        235,
        139,
        247,
        198,
        12
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true,
          "relations": [
            "tab"
          ]
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "client"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "callId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "fundLedger",
      "docs": [
        "Lamports for the Ledger's commit / Magic Action fees on the fee-vault path. Base layer, before delegation."
      ],
      "discriminator": [
        130,
        23,
        207,
        234,
        98,
        66,
        20,
        2
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "lamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "stakeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "operator",
          "type": "pubkey"
        },
        {
          "name": "validator",
          "type": "pubkey"
        },
        {
          "name": "checkpointEveryCalls",
          "type": "u32"
        },
        {
          "name": "checkpointEverySecs",
          "type": "u32"
        },
        {
          "name": "unstakeCooldownSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "openTab",
      "docs": [
        "Deposit USDC into the vault and credit the client's Tab. `sponsor_lamports` funds the Tab so it can pay",
        "ER rent for the ephemeral CallReceipts it sponsors. Only while the Tab is not delegated."
      ],
      "discriminator": [
        76,
        59,
        11,
        59,
        218,
        58,
        30,
        59
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "client"
              }
            ]
          }
        },
        {
          "name": "clientToken",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "sponsorLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "payForCall",
      "docs": [
        "Pay for one agent call from the Tab, credit the agent and create its CallReceipt — atomically, on the ER."
      ],
      "discriminator": [
        96,
        109,
        107,
        40,
        242,
        120,
        106,
        218
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true,
          "relations": [
            "tab"
          ]
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "client"
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "agentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "client"
              },
              {
                "kind": "account",
                "path": "tab.next_nonce",
                "account": "tab"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "callId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "resourceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "payout",
      "docs": [
        "Runs on base after a checkpoint commit. Pays `earned_total - paid_total` from the vault to the payee.",
        "Idempotent: a retried or duplicated action pays 0. Only reachable through a post-commit action scheduled",
        "by this program (escrow signer bound to the Ledger PDA)."
      ],
      "discriminator": [
        149,
        140,
        194,
        236,
        174,
        189,
        6,
        239
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "agentStats",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "agentPayout",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  111,
                  117,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "payee",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "escrowAuth",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "escrow",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "registerAgent",
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "agentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "agentPayout",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  121,
                  111,
                  117,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "payee"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "u64"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "skill",
          "type": "string"
        },
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "priceUnits",
          "type": "u64"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    },
    {
      "name": "requestUnstake",
      "discriminator": [
        44,
        154,
        110,
        253,
        160,
        202,
        54,
        34
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agentProfile"
          ]
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "scheduleCheckpoints",
      "docs": [
        "Crank: ask the ER scheduler to run `checkpoint` every `interval_ms`. remaining_accounts are the exact",
        "accounts `checkpoint` needs (see `Checkpoint` + its remaining accounts), in order."
      ],
      "discriminator": [
        235,
        36,
        201,
        186,
        41,
        96,
        7,
        83
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "i64"
        },
        {
          "name": "intervalMs",
          "type": "i64"
        },
        {
          "name": "iterations",
          "type": "i64"
        },
        {
          "name": "agentCount",
          "type": "u8"
        }
      ]
    },
    {
      "name": "setActive",
      "docs": [
        "Agent owner pause/resume; config authority may use it only as an emergency stop."
      ],
      "discriminator": [
        29,
        16,
        225,
        132,
        38,
        216,
        206,
        33
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "active",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPayee",
      "discriminator": [
        99,
        215,
        50,
        44,
        239,
        35,
        255,
        89
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agentProfile"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "payee"
        }
      ],
      "args": []
    },
    {
      "name": "slash",
      "discriminator": [
        204,
        141,
        18,
        161,
        8,
        177,
        92,
        142
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "stakeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "recipient",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "stake",
      "discriminator": [
        206,
        176,
        202,
        18,
        200,
        209,
        179,
        108
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agentProfile"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "stakeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitFeedback",
      "docs": [
        "One review per paid call. Operator key → Operator (only for calls the operator paid for);",
        "the paying client → Client (independent). Closes the receipt; its ER rent returns to the Tab."
      ],
      "discriminator": [
        222,
        189,
        16,
        203,
        186,
        151,
        236,
        188
      ],
      "accounts": [
        {
          "name": "reviewer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "tab.client",
                "account": "tab"
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "agentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true
        },
        {
          "name": "vault",
          "writable": true,
          "address": "MagicVau1t999999999999999999999999999999999"
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "u64"
        },
        {
          "name": "callId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "score",
          "type": "u8"
        }
      ]
    },
    {
      "name": "transferAgentOwnership",
      "discriminator": [
        216,
        78,
        134,
        193,
        175,
        186,
        233,
        25
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agentProfile"
          ]
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "undelegateAgentStats",
      "discriminator": [
        164,
        100,
        97,
        105,
        189,
        113,
        173,
        107
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentStats",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  116,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "agentId"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "undelegateLedger",
      "discriminator": [
        31,
        179,
        227,
        110,
        78,
        195,
        160,
        68
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegateTab",
      "discriminator": [
        6,
        184,
        12,
        161,
        78,
        94,
        250,
        113
      ],
      "accounts": [
        {
          "name": "client",
          "writable": true,
          "signer": true,
          "relations": [
            "tab"
          ]
        },
        {
          "name": "tab",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  98
                ]
              },
              {
                "kind": "account",
                "path": "client"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "unstake",
      "discriminator": [
        90,
        95,
        107,
        42,
        205,
        124,
        50,
        225
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agentProfile"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        },
        {
          "name": "ownerToken",
          "writable": true
        },
        {
          "name": "stakeVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "updateAgent",
      "discriminator": [
        85,
        2,
        178,
        9,
        119,
        139,
        102,
        164
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "agentProfile"
          ]
        },
        {
          "name": "agentProfile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "agent_profile.agent_id",
                "account": "agentProfile"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "priceUnits",
          "type": "u64"
        },
        {
          "name": "metadataUri",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agentPayout",
      "discriminator": [
        182,
        223,
        204,
        63,
        116,
        108,
        85,
        114
      ]
    },
    {
      "name": "agentProfile",
      "discriminator": [
        60,
        227,
        42,
        24,
        0,
        87,
        86,
        205
      ]
    },
    {
      "name": "agentStats",
      "discriminator": [
        43,
        192,
        26,
        112,
        162,
        176,
        77,
        164
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "ledger",
      "discriminator": [
        43,
        41,
        21,
        213,
        180,
        176,
        95,
        32
      ]
    },
    {
      "name": "tab",
      "discriminator": [
        194,
        242,
        40,
        53,
        214,
        169,
        9,
        172
      ]
    }
  ],
  "events": [
    {
      "name": "activeSet",
      "discriminator": [
        204,
        68,
        242,
        65,
        134,
        117,
        207,
        64
      ]
    },
    {
      "name": "agentRegistered",
      "discriminator": [
        191,
        78,
        217,
        54,
        232,
        100,
        189,
        85
      ]
    },
    {
      "name": "agentUpdated",
      "discriminator": [
        210,
        179,
        162,
        250,
        123,
        250,
        210,
        166
      ]
    },
    {
      "name": "checkpointScheduled",
      "discriminator": [
        224,
        42,
        96,
        218,
        203,
        5,
        239,
        178
      ]
    },
    {
      "name": "feedbackSubmitted",
      "discriminator": [
        41,
        21,
        127,
        219,
        28,
        103,
        196,
        49
      ]
    },
    {
      "name": "ownershipTransferred",
      "discriminator": [
        172,
        61,
        205,
        183,
        250,
        50,
        38,
        98
      ]
    },
    {
      "name": "paidCall",
      "discriminator": [
        156,
        109,
        11,
        63,
        176,
        27,
        108,
        64
      ]
    },
    {
      "name": "paidOut",
      "discriminator": [
        6,
        137,
        209,
        225,
        252,
        53,
        249,
        252
      ]
    },
    {
      "name": "payeeChanged",
      "discriminator": [
        226,
        239,
        218,
        4,
        227,
        219,
        131,
        166
      ]
    },
    {
      "name": "slashed",
      "discriminator": [
        98,
        59,
        249,
        154,
        233,
        53,
        98,
        194
      ]
    },
    {
      "name": "staked",
      "discriminator": [
        11,
        146,
        45,
        205,
        230,
        58,
        213,
        240
      ]
    },
    {
      "name": "tabClosed",
      "discriminator": [
        148,
        211,
        174,
        8,
        248,
        190,
        59,
        9
      ]
    },
    {
      "name": "tabOpened",
      "discriminator": [
        230,
        156,
        126,
        232,
        83,
        136,
        126,
        17
      ]
    },
    {
      "name": "unstaked",
      "discriminator": [
        27,
        179,
        156,
        215,
        47,
        71,
        195,
        7
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Not authorized"
    },
    {
      "code": 6001,
      "name": "badAgentId",
      "msg": "agent_id must be agent_count + 1"
    },
    {
      "code": 6002,
      "name": "badString",
      "msg": "String empty or too long"
    },
    {
      "code": 6003,
      "name": "badPayee",
      "msg": "Payee must be a USDC token account owned by the agent owner"
    },
    {
      "code": 6004,
      "name": "badOwner",
      "msg": "Invalid owner"
    },
    {
      "code": 6005,
      "name": "zeroAmount",
      "msg": "Amount must be > 0"
    },
    {
      "code": 6006,
      "name": "badAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6007,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6008,
      "name": "nothingPending",
      "msg": "No unstake pending"
    },
    {
      "code": 6009,
      "name": "cooldownActive",
      "msg": "Unstake cooldown still active"
    },
    {
      "code": 6010,
      "name": "wrongValidator",
      "msg": "Validator does not match the pinned ER validator"
    },
    {
      "code": 6011,
      "name": "agentInactive",
      "msg": "Agent is not active"
    },
    {
      "code": 6012,
      "name": "underpaid",
      "msg": "Amount is below the agent's price"
    },
    {
      "code": 6013,
      "name": "insufficientTab",
      "msg": "Tab balance too low"
    },
    {
      "code": 6014,
      "name": "staleCallId",
      "msg": "call_id must start with the Tab's next nonce"
    },
    {
      "code": 6015,
      "name": "badScore",
      "msg": "Score must be 0-100"
    },
    {
      "code": 6016,
      "name": "noReceipt",
      "msg": "No receipt for this call"
    },
    {
      "code": 6017,
      "name": "alreadyReviewed",
      "msg": "Call already reviewed"
    },
    {
      "code": 6018,
      "name": "notOperatorCall",
      "msg": "Operator can only review calls it paid for"
    },
    {
      "code": 6019,
      "name": "notPayer",
      "msg": "Only the paying client can review this call"
    },
    {
      "code": 6020,
      "name": "selfReview",
      "msg": "The agent's owner or the market authority cannot write a client review"
    },
    {
      "code": 6021,
      "name": "wrongFeeVault",
      "msg": "magic_fee_vault is not the pinned validator's fee vault"
    },
    {
      "code": 6022,
      "name": "badRemainingAccounts",
      "msg": "Bad remaining accounts"
    }
  ],
  "types": [
    {
      "name": "activeSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "by",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "agentPayout",
      "docs": [
        "Base layer, never delegated. Written only by the payout Magic Action."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "paidTotal",
            "type": "u64"
          },
          {
            "name": "payouts",
            "type": "u64"
          },
          {
            "name": "lastPaidSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentProfile",
      "docs": [
        "Base layer. ERC-8004-style identity with its own owner and payee."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "docs": [
              "USDC token account owned by `owner` (checked when set)"
            ],
            "type": "pubkey"
          },
          {
            "name": "priceUnits",
            "type": "u64"
          },
          {
            "name": "active",
            "type": "bool"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "unstakePending",
            "type": "u64"
          },
          {
            "name": "unstakeRequestedAt",
            "type": "i64"
          },
          {
            "name": "slashedTotal",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "skill",
            "type": "string"
          },
          {
            "name": "endpoint",
            "type": "string"
          },
          {
            "name": "metadataUri",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "agentRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "type": "pubkey"
          },
          {
            "name": "priceUnits",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "agentStats",
      "docs": [
        "Delegated. Per-agent earnings and split reputation, updated on the ER every call."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "earnedTotal",
            "docs": [
              "Monotonic. Payout pays `earned_total - AgentPayout.paid_total`, so payouts are idempotent."
            ],
            "type": "u64"
          },
          {
            "name": "paidCalls",
            "type": "u64"
          },
          {
            "name": "clientScoreSum",
            "type": "u64"
          },
          {
            "name": "clientReviews",
            "type": "u64"
          },
          {
            "name": "operatorScoreSum",
            "type": "u64"
          },
          {
            "name": "operatorReviews",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "agentUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "priceUnits",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "checkpointScheduled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agents",
            "type": "u8"
          },
          {
            "name": "tabs",
            "type": "u8"
          },
          {
            "name": "forced",
            "type": "bool"
          },
          {
            "name": "at",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "config",
      "docs": [
        "Base layer. Global settings and the vault authority."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "operator",
            "docs": [
              "Mode A operator: its reviews of calls it paid for are stored as Operator, never Client"
            ],
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "validator",
            "docs": [
              "Pinned ER validator — every delegation goes here so related accounts share one ER"
            ],
            "type": "pubkey"
          },
          {
            "name": "agentCount",
            "type": "u64"
          },
          {
            "name": "checkpointEveryCalls",
            "type": "u32"
          },
          {
            "name": "checkpointEverySecs",
            "type": "u32"
          },
          {
            "name": "unstakeCooldownSecs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "stakeVaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "feedbackSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "callId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "reviewer",
            "type": "pubkey"
          },
          {
            "name": "kind",
            "type": {
              "defined": {
                "name": "reviewerKind"
              }
            }
          },
          {
            "name": "score",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ledger",
      "docs": [
        "Delegated. The program's delegated fee payer for commits (magic_fee_vault path), the escrow authority",
        "for payout Magic Actions, and the counters that rate-limit permissionless checkpoints."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "callsSinceCheckpoint",
            "type": "u64"
          },
          {
            "name": "totalCalls",
            "type": "u64"
          },
          {
            "name": "lastCheckpointTs",
            "type": "i64"
          },
          {
            "name": "checkpoints",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "ownershipTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "previous",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "paidCall",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "callId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "resourceHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "slot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "paidOut",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "paidTotal",
            "type": "u64"
          },
          {
            "name": "payee",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "payeeChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "previous",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "reviewerKind",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "client"
          },
          {
            "name": "operator"
          }
        ]
      }
    },
    {
      "name": "slashed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "staked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "total",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tab",
      "docs": [
        "Delegated. A client's prepaid balance; its USDC sits in the program vault on base."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "spent",
            "type": "u64"
          },
          {
            "name": "nextNonce",
            "docs": [
              "The first 8 bytes of every call_id must equal this (LE); a closed receipt can never be recreated"
            ],
            "type": "u64"
          },
          {
            "name": "openReceipts",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tabClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "refund",
            "type": "u64"
          },
          {
            "name": "spent",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tabOpened",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "deposited",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "unstaked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentId",
            "type": "u64"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "total",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
