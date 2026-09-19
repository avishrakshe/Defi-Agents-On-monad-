import { ethers } from "ethers";

export const MONAD_CHAIN_CONFIG = {
  chainId: "0x279f", // 10143 in hex
  chainIdDecimal: 10143,
  chainName: "Monad Testnet",
  nativeCurrency: {
    name: "MON",
    symbol: "MON",
    decimals: 18,
  },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadvision.com"],
};

export const MONAD_USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";

/**
 * Connect to MetaMask or injected Web3 provider safely
 */
export async function connectBrowserWallet(): Promise<{ address: string; chainId: number }> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask or Web3 wallet extension not detected. Please install MetaMask to use Mode B.");
  }

  const ethereum = (window as any).ethereum;

  // Request account access
  const accounts: string[] = await ethereum.request({
    method: "eth_requestAccounts",
    params: []
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No Ethereum account selected in wallet.");
  }

  // Get current chain ID
  const currentChainHex = await ethereum.request({ method: "eth_chainId" });
  const currentChainId = parseInt(currentChainHex, 16);

  // Switch to Monad Testnet if on a different chain
  if (currentChainId !== MONAD_CHAIN_CONFIG.chainIdDecimal) {
    await switchToMonadNetwork();
  }

  return {
    address: accounts[0],
    chainId: MONAD_CHAIN_CONFIG.chainIdDecimal
  };
}

/**
 * Add / Switch to Monad Testnet via EIP-3085 / EIP-3326
 */
export async function switchToMonadNetwork(): Promise<void> {
  if (typeof window === "undefined" || !(window as any).ethereum) return;
  const ethereum = (window as any).ethereum;

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_CHAIN_CONFIG.chainId }],
    });
  } catch (switchError: any) {
    // Error 4902 indicates chain has not been added yet to wallet
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: MONAD_CHAIN_CONFIG.chainId,
          chainName: MONAD_CHAIN_CONFIG.chainName,
          nativeCurrency: MONAD_CHAIN_CONFIG.nativeCurrency,
          rpcUrls: MONAD_CHAIN_CONFIG.rpcUrls,
          blockExplorerUrls: MONAD_CHAIN_CONFIG.blockExplorerUrls,
        }],
      });
    } else {
      throw switchError;
    }
  }
}

/**
 * Sign REAL EIP-712 Typed Data for x402 / EIP-3009 USDC Micropayment
 */
export async function signRealX402Payment(
  fromAddress: string,
  payToAddress: string,
  amountUSDCUnits: string = "1000" // 0.001 USDC in 6 decimals
): Promise<any> {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask not found");
  }

  const ethereum = (window as any).ethereum;

  // Validity window: valid now until 1 hour from now
  const now = Math.floor(Date.now() / 1000);
  const validAfter = now - 60; // 1 min ago
  const validBefore = now + 3600; // 1 hour ahead
  const nonce = ethers.hexlify(ethers.randomBytes(32));

  // EIP-712 Domain for Monad Testnet USDC
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: MONAD_CHAIN_CONFIG.chainIdDecimal,
    verifyingContract: MONAD_USDC_ADDRESS
  };

  // EIP-3009 TransferWithAuthorization Types
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  };

  const message = {
    from: ethers.getAddress(fromAddress),
    to: ethers.getAddress(payToAddress),
    value: amountUSDCUnits,
    validAfter,
    validBefore,
    nonce
  };

  const provider = new ethers.BrowserProvider(ethereum);
  const signer = await provider.getSigner();

  // Prompt MetaMask for REAL EIP-712 signature
  const signature = await signer.signTypedData(domain, types, message);
  const sig = ethers.Signature.from(signature);

  return {
    scheme: "exact",
    network: "eip155:10143",
    from: fromAddress,
    to: payToAddress,
    value: amountUSDCUnits,
    validAfter,
    validBefore,
    nonce,
    v: sig.v,
    r: sig.r,
    s: sig.s,
    signature,
    timestamp: new Date().toISOString()
  };
}
