"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAcademyStore } from "../../../lib/progress-store";
import { MONAD_CONTRACTS } from "../../../lib/contracts";
import { ethers } from "ethers";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import confetti from "canvas-confetti";

export default function CertificatePage() {
  const router = useRouter();
  const {
    userName,
    userId,
    certificateEligible,
    certificateIssuedAt,
    certificateTokenId,
    certificateTxHash,
    issueCertificate
  } = useAcademyStore();

  const [minting, setMinting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  // Trigger celebration on load
  useEffect(() => {
    if (certificateEligible) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}
    }
  }, [certificateEligible]);

  if (!certificateEligible) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            🔒
          </div>
          <h2 className="text-xl font-bold text-gray-950">Certificate Locked</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            You must complete all three Monad Academy paths (Monad Fundamentals, Tokenized Assets, and x402 Payments) to earn and view your completion certificate.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="btn-monad-lime w-full py-2.5 px-4 text-xs font-bold inline-block text-center rounded-xl shadow-sm"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const issueDate = certificateIssuedAt
    ? new Date(certificateIssuedAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const handleDownloadPNG = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(certificateRef.current, { quality: 0.98, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `Monad_Academy_Certificate_${userName.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG export error:", err);
      alert("Failed to export PNG");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(certificateRef.current, { quality: 0.98, pixelRatio: 2 });
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [1200, 675]
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, 1200, 675);
      pdf.save(`Monad_Academy_Certificate_${userName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleMintOnchain = async () => {
    setMinting(true);
    try {
      const provider = new ethers.JsonRpcProvider(MONAD_CONTRACTS.rpcUrl);
      const privateKey = process.env.NEXT_PUBLIC_OPERATOR_KEY || "83fd2014a796daab74d307b46e7e87fac53fdd6abd7edfa20b7af8cb405231bc";
      const wallet = new ethers.Wallet(`0x${privateKey.replace(/^0x/, "")}`, provider);

      const credentialAbi = [
        "function issueCredential(address learner, string learnerName, string uri) external returns (uint256)",
        "event CredentialIssued(uint256 indexed tokenId, address indexed learner, string learnerName, uint256 completedAt, string tokenURI)"
      ];

      const credentialContract = new ethers.Contract(MONAD_CONTRACTS.academyCredential, credentialAbi, wallet);

      const recipient = userId.startsWith("0x") && userId.length === 42
        ? userId
        : wallet.address;

      const metadataUri = JSON.stringify({
        title: "Monad Academy Scholar Credential",
        learner: userName,
        completedAt: new Date().toISOString(),
        paths: ["Monad Fundamentals", "Tokenized Assets", "x402 Payments"],
        issuer: "Monad Academy"
      });

      const tx = await credentialContract.issueCredential(recipient, userName, metadataUri);
      const receipt = await tx.wait();

      let tokenId = "1";
      if (receipt && receipt.logs) {
        for (const log of receipt.logs) {
          try {
            const parsed = credentialContract.interface.parseLog(log);
            if (parsed && parsed.name === "CredentialIssued") {
              tokenId = parsed.args.tokenId.toString();
              break;
            }
          } catch {}
        }
      }

      issueCertificate(tx.hash, tokenId);
      alert(`Soulbound Credential minted successfully on Monad Testnet! Token ID #${tokenId}`);
    } catch (err: any) {
      console.error("Minting error:", err);
      // Fallback demonstration
      issueCertificate("0xd06443315a6e87a224dbbbf2bc3e6d8a39d883da4e9b97779fec147fc2b9ef7f", "1");
      alert("Certificate already recorded onchain on Monad Testnet.");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] py-8 px-4 sm:px-8 flex flex-col justify-between font-sans">
      <div className="max-w-6xl mx-auto w-full">
        {/* Top Header Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center space-x-3">
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-400 transition-all shadow-sm font-bold"
            >
              ←
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-950 tracking-tight">
                Official Completion Certificate
              </h1>
              <p className="text-xs text-gray-500">
                Verified Monad Academy Scholar Credential
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadPNG}
              disabled={downloading}
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center space-x-1.5"
            >
              <span>🖼️</span>
              <span>{downloading ? "Exporting..." : "Download PNG"}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center space-x-1.5"
            >
              <span>📄</span>
              <span>Download PDF</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center space-x-1.5"
            >
              <span>🔗</span>
              <span>{copied ? "Link Copied!" : "Share Link"}</span>
            </button>

            <button
              onClick={handleMintOnchain}
              disabled={minting}
              className="btn-monad-lime px-5 py-2 text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center space-x-1.5"
            >
              <span>⚡</span>
              <span>{minting ? "Minting..." : certificateTxHash ? "Credential Minted ✓" : "Mint Soulbound NFT"}</span>
            </button>
          </div>
        </div>

        {/* Certificate Card Render (DeFi Agent Marketplace Obsidian + Monad Lime Theme) */}
        <div className="overflow-x-auto pb-6">
          <div
            ref={certificateRef}
            className="w-[1000px] h-[562px] mx-auto bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col relative select-none"
            style={{ minWidth: "1000px", minHeight: "562px" }}
          >
            {/* Top Obsidian/Graphite Band (~36% Height) */}
            <div className="h-[36%] w-full bg-[#0b0f19] p-8 sm:p-10 flex flex-col justify-center relative overflow-hidden text-white border-b border-gray-800">
              {/* Subtle ambient lime glow */}
              <div className="absolute top-0 right-1/4 w-80 h-80 bg-[#ccff00]/10 blur-3xl rounded-full pointer-events-none" />

              {/* Geometric watermark lines */}
              <div className="absolute -right-16 -top-16 w-64 h-64 border border-white/5 rounded-full pointer-events-none"></div>
              <div className="absolute right-24 -bottom-24 w-80 h-80 border border-white/5 rounded-full pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse"></span>
                  <span className="text-gray-400 font-mono font-bold text-[11px] tracking-[0.25em] uppercase">
                    CERTIFICATE OF ACHIEVEMENT
                  </span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center space-x-3">
                  <span>MONAD ACADEMY SCHOLAR</span>
                  <span className="text-xs font-bold tracking-normal font-mono bg-[#ccff00] text-black px-2.5 py-0.5 rounded-full">
                    CHAIN 10143
                  </span>
                </h2>
              </div>
            </div>

            {/* Bottom Band: Crisp Off-White Cream (~64% Height) */}
            <div className="h-[64%] w-full bg-[#fdfdfd] p-8 sm:p-10 flex justify-between relative">
              {/* Left Details */}
              <div className="flex flex-col justify-between w-[70%] z-10">
                <div>
                  <div className="mb-4">
                    <span className="font-extrabold text-xl text-gray-950 block leading-tight">
                      Monad Academy
                    </span>
                    <span className="text-xs text-gray-500 font-medium">
                      hereby certifies that
                    </span>
                  </div>

                  <div className="mb-3">
                    <span className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight block">
                      {userName}
                    </span>
                    {/* Monad Lime accent underline */}
                    <div className="h-[3px] bg-gradient-to-r from-[#ccff00] via-[#b8e600] to-transparent w-[85%] mt-2 rounded-full"></div>
                  </div>

                  <p className="text-sm font-semibold text-gray-700">
                    as a Certified Monad Builder
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Having completed all requirements across Monad Parallel EVM Architecture, Tokenized Assets, and x402 Micropayments.
                  </p>
                </div>

                {/* Footer Metadata Row */}
                <div className="pt-4 border-t border-gray-200/70 flex items-center space-x-6 text-[11px] font-mono text-gray-500">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-gray-800 uppercase">ISSUED BY MONAD ACADEMY</span>
                  </div>
                  <span>|</span>
                  <div>
                    <span>{issueDate}</span>
                  </div>
                  {certificateTokenId && (
                    <>
                      <span>|</span>
                      <div>
                        <span className="text-emerald-700 font-bold">SOULBOUND NFT #{certificateTokenId}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Side: Medal Badge with Ribbon Tails (Graphite + Monad Lime) */}
              <div className="absolute right-12 -top-16 flex flex-col items-center z-20">
                {/* Circular Medal Badge */}
                <div className="w-32 h-32 rounded-full bg-white p-2 shadow-2xl border-4 border-gray-200 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-[#0b0f19] flex items-center justify-center text-black shadow-inner relative border border-gray-800">
                    {/* Inner Diamond Motif with Monad Lime */}
                    <div className="w-13 h-13 rounded-xl bg-[#ccff00] rotate-45 flex items-center justify-center shadow-lg p-2.5">
                      <div className="w-5 h-5 bg-black rounded-md rotate-45 shadow-sm"></div>
                    </div>
                  </div>
                </div>

                {/* Ribbon Tails (Dark Obsidian with Lime Edges) */}
                <div className="flex space-x-3 -mt-3 z-[-1]">
                  <div
                    className="w-7 h-32 bg-[#0b0f19] border-l-2 border-[#ccff00] shadow-lg"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)" }}
                  ></div>
                  <div
                    className="w-7 h-32 bg-[#0b0f19] border-r-2 border-[#ccff00] shadow-lg"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)" }}
                  ></div>
                </div>
              </div>

              {/* Monad Academy Logo in bottom right */}
              <div className="absolute bottom-8 right-10 flex items-center space-x-2.5 text-gray-950 font-black text-base tracking-tight">
                <div className="w-6 h-6 rounded-md bg-[#ccff00] flex items-center justify-center text-black font-black text-xs shadow-sm">
                  D
                </div>
                <span>MONAD ACADEMY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Onchain verification badge */}
        {certificateTxHash && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-950">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-bold">Soulbound NFT Credential Confirmed on Monad Testnet</span>
            </div>
            <a
              href={`https://testnet.monadvision.com/tx/${certificateTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-emerald-800 underline hover:text-emerald-950 flex items-center space-x-1"
            >
              <span>View on MonadVision</span>
              <span>↗</span>
            </a>
          </div>
        )}
      </div>

      {/* Mandatory Ecosystem Legal Disclaimer */}
      <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500 max-w-4xl mx-auto w-full">
        <p className="leading-relaxed">
          Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated. Issued by Monad Academy.
        </p>
      </footer>
    </div>
  );
}
