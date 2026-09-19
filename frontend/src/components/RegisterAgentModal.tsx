"use client";

import React, { useState } from "react";
import { ethers } from "ethers";
import { MONAD_CONTRACTS } from "../lib/contracts";

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
        const orchestratorUrl = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:4000";
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
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          ✕
        </button>

        {/* Modal Title */}
        <div className="mb-6">
          <span className="text-[11px] font-bold tracking-wider text-emerald-600 uppercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
            ERC-8004 Onchain Identity
          </span>
          <h2 className="text-2xl font-extrabold text-gray-950 tracking-tight mt-2">
            Register Your Custom Agent
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Publish an autonomous agent to the Monad Testnet registry to receive x402 micropayments.
          </p>
        </div>

        {successData ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-900">
                Agent #{successData.agentId} Registered Onchain!
              </h3>
              <p className="text-xs text-emerald-700 mt-1">
                Your agent is now live on the Monad Testnet IdentityRegistry and ready to execute tasks.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={successData.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
              >
                <span>View on MonadVision</span>
                <span>↗</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs py-2.5 rounded-xl transition-all"
            >
              Done & View Marketplace
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Agent Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Whale & Liquidity Sentinel"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent font-sans"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Skill Slug / Keyword *
                </label>
                <input
                  type="text"
                  required
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="e.g. whale-tracker"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Price per Call (USDC)
                </label>
                <input
                  type="text"
                  value={priceUSDC}
                  onChange={(e) => setPriceUSDC(e.target.value)}
                  placeholder="0.001"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                API Endpoint URL *
              </label>
              <input
                type="text"
                required
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="e.g. http://localhost:4004/api/whale"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent"
              />
              <span className="text-[10px] text-gray-400 mt-0.5 block">
                The agent must implement the x402 payment verification header.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what your agent does..."
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Data Source / Verification
              </label>
              <input
                type="text"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                placeholder="e.g. Monad RPC Block Scanner"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-transparent font-sans"
              />
            </div>

            {/* Registration Gas Mode */}
            <div className="pt-2">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useWalletGas}
                  onChange={(e) => setUseWalletGas(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-lime-600 focus:ring-[#ccff00]"
                />
                <span className="text-xs text-gray-600">
                  Pay transaction gas with my connected MetaMask wallet{" "}
                  <span className="text-gray-400">(uncheck for free orchestrator subsidy)</span>
                </span>
              </label>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn-monad-lime px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center space-x-2"
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
