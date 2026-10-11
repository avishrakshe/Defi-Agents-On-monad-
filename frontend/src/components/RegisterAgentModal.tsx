"use client";

import React, { useState } from "react";
import { ORCHESTRATOR_ADDRESS } from "../lib/useBalances";
import { ethers } from "ethers";
import { MONAD_CONTRACTS } from "../lib/contracts";
import { useActivityStore } from "../lib/activity-store";
import { getOrchestratorUrl } from "../lib/orchestrator";

interface RegisterAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentRegistered: () => void;
}

export const RegisterAgentModal: React.FC<RegisterAgentModalProps> = ({
  isOpen,
  onClose,
  onAgentRegistered
}) => {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [endpoint, setEndpoint] = useState("http://localhost:4004/api/whale");
  const [priceUSDC, setPriceUSDC] = useState("0.001");
  const [description, setDescription] = useState(
    "Autonomous onchain sentinel analyzing live Monad Testnet DEX liquidity and large whale transfers."
  );
  const [dataSource, setDataSource] = useState("Monad Testnet RPC Block Scanner");
  const [useWalletGas, setUseWalletGas] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    agentId: number;
    txHash: string;
    explorerUrl: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessData(null);

    try {
      if (!name.trim() || !skill.trim() || !endpoint.trim()) {
        throw new Error("Name, skill slug, and endpoint URL are required.");
      }

      const priceUnits = Math.round(parseFloat(priceUSDC || "0.001") * 1_000_000);

      if (useWalletGas && typeof window !== "undefined" && (window as any).ethereum) {
        // Mode B: User MetaMask wallet registers directly onchain
        const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await browserProvider.getSigner();

        const identityAbi = [
          "function registerAgent(string name, string skill, string endpoint, uint256 priceUSDC, string metadataURI) external returns (uint256)",
          "event AgentRegistered(uint256 indexed agentId, address indexed owner, string skill, string name, uint256 priceUSDC, string endpoint, string metadataURI)"
        ];

        const identityContract = new ethers.Contract(MONAD_CONTRACTS.identityRegistry, identityAbi, signer);

        const metadataJSON = JSON.stringify({
          description,
          dataSource,
          author: await signer.getAddress(),
          registeredVia: "DeFi Agent Marketplace Monad"
        });

        const tx = await identityContract.registerAgent(
          name.trim(),
          skill.trim().toLowerCase(),
          endpoint.trim(),
          priceUnits,
          metadataJSON
        );

        const receipt = await tx.wait();

        let registeredId = 4;
        if (receipt && receipt.logs) {
          for (const log of receipt.logs) {
            try {
              const parsed = identityContract.interface.parseLog(log);
              if (parsed && parsed.name === "AgentRegistered") {
                registeredId = Number(parsed.args.agentId);
                break;
              }
            } catch {}
          }
        }

        setSuccessData({
          agentId: registeredId,
          txHash: tx.hash,
          explorerUrl: `https://testnet.monadvision.com/tx/${tx.hash}`
        });
      } else {
        // Mode A: Orchestrator relays registration
        const orchestratorUrl = getOrchestratorUrl();
        const res = await fetch(`${orchestratorUrl}/api/register-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            skill: skill.trim().toLowerCase(),
            endpoint: endpoint.trim(),
            priceUSDC: priceUnits,
            description: description.trim(),
            dataSource: dataSource.trim()
          })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.details || data.error || "Failed to register agent onchain");
        }

        setSuccessData({
          agentId: data.agentId || 4,
          txHash: data.txHash,
          explorerUrl: data.explorerUrl
        });

        // Record agent registration transaction
        try {
          useActivityStore.getState().addActivity({
            type: "agent_registration",
            title: `Registered Agent #${data.agentId || 4}: ${name.trim()}`,
            description: `Onchain registration on IdentityRegistry with endpoint ${endpoint.trim()} ($${priceUSDC} tUSDC).`,
            txHash: data.txHash,
            timestamp: new Date().toISOString(),
            status: "confirmed",
            from: ORCHESTRATOR_ADDRESS,
            to: MONAD_CONTRACTS.identityRegistry,
            contractName: "IdentityRegistry",
            agentId: data.agentId || 4,
            agentName: name.trim(),
            skill: skill.trim().toLowerCase(),
            amount: `$${priceUSDC} tUSDC`,
            gasFee: "0.00065 MON",
            metadata: {
              endpoint: endpoint.trim(),
              description: description.trim(),
              dataSource: dataSource.trim()
            }
          });
        } catch (e) {
          console.warn("Could not log agent registration:", e);
        }
      }

      onAgentRegistered();
    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMsg(err.message || "Failed to register agent on Monad Testnet.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-paper-card rounded-none border border-ink/20 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-ink-3 hover:text-ink w-8 h-8 rounded-full flex items-center justify-center bg-paper-shade hover:bg-paper-deep transition-colors"
        >
          ✕
        </button>

        {/* Modal Title */}
        <div className="mb-6">
          <span className="text-[11px] font-bold tracking-wider text-moss uppercase bg-moss-soft px-2.5 py-0.5 rounded-full border border-moss/40">
            ERC-8004 Onchain Identity
          </span>
          <h2 className="text-2xl font-extrabold text-ink tracking-tight mt-2">
            Register Your Custom Agent
          </h2>
          <p className="text-xs text-ink-2 mt-1">
            Publish an autonomous agent to the Monad Testnet registry to receive x402 micropayments.
          </p>
        </div>

        {successData ? (
          <div className="bg-moss-soft border border-moss/40 rounded-none p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-moss text-ink rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-moss">
                Agent #{successData.agentId} Registered Onchain!
              </h3>
              <p className="text-xs text-moss mt-1">
                Your agent is now live on the Monad Testnet IdentityRegistry and ready to execute tasks.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={successData.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-none bg-moss hover:bg-emerald-700 text-ink text-xs font-bold transition-all shadow-sm"
              >
                <span>View on MonadVision</span>
                <span>↗</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 bg-paper-shade hover:bg-paper-deep text-ink font-semibold text-xs py-2.5 rounded-none transition-all"
            >
              Done & View Marketplace
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {errorMsg && (
              <div className="bg-flame-soft border border-flame/40 text-flame text-xs p-3 rounded-none">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Agent Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Whale & Liquidity Sentinel"
                className="w-full bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Skill Slug / Keyword *
                </label>
                <input
                  type="text"
                  required
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="e.g. whale-tracker"
                  className="w-full bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  Price per Call (USDC)
                </label>
                <input
                  type="text"
                  value={priceUSDC}
                  onChange={(e) => setPriceUSDC(e.target.value)}
                  placeholder="0.001"
                  className="w-full bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                API Endpoint URL *
              </label>
              <input
                type="text"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="e.g. http://localhost:4004/api/whale"
                className="w-full bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent"
              />
              <span className="text-[10px] text-ink-3 mt-0.5 block">
                The agent must implement the x402 payment verification header.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what your agent does..."
                className="w-full bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Data Source / Verification
              </label>
              <input
                type="text"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                placeholder="e.g. Monad RPC Block Scanner"
                className="w-full bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent font-sans"
              />
            </div>

            {/* Registration Gas Mode */}
            <div className="pt-2">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useWalletGas}
                  onChange={(e) => setUseWalletGas(e.target.checked)}
                  className="w-4 h-4 rounded border-ink/25 text-violet focus:ring-violet"
                />
                <span className="text-xs text-ink-2">
                  Pay transaction gas with my connected MetaMask wallet{" "}
                  <span className="text-ink-3">(uncheck for free orchestrator subsidy)</span>
                </span>
              </label>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-ink/20">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-none border border-ink/20 text-ink-2 text-xs font-semibold hover:bg-sun-soft transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn-neon btn-sm px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-black animate-ping"></span>
                    <span>Publishing Onchain...</span>
                  </>
                ) : (
                  <span>Register on Monad Testnet</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
