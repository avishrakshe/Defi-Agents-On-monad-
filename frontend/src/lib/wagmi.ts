import { http, createConfig } from "wagmi";
import { monadTestnet } from "./monadChain";

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz"),
  },
  ssr: true,
});
