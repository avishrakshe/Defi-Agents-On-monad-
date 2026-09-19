/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_MONAD_NETWORK: process.env.NEXT_PUBLIC_MONAD_NETWORK || "eip155:10143",
    NEXT_PUBLIC_MONAD_CHAIN_ID: process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143",
    NEXT_PUBLIC_MONAD_CHAIN_NAME: process.env.NEXT_PUBLIC_MONAD_CHAIN_NAME || "Monad Testnet",
    NEXT_PUBLIC_MONAD_RPC_URL: process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
    NEXT_PUBLIC_MONAD_USDC_ADDRESS: process.env.NEXT_PUBLIC_MONAD_USDC_ADDRESS || "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    NEXT_PUBLIC_ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || "http://localhost:4000"
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/svm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@base-org/account": false,
      "@coinbase/cdp-sdk": false,
    };
    return config;
  }
};

module.exports = nextConfig;
