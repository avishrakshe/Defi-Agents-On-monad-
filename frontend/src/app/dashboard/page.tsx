"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "../../components/Navbar";
import { PageBackdrop, SiteFooter } from "../../components/PageChrome";
import { useAcademyStore } from "../../lib/progress-store";

export default function DashboardPage() {
  const {
    userName,
    setUserName,
    paths,
    totalXp,
    currentStreak,
    certificateEligible,
    completeLesson,
    markPathComplete,
    markAllCompleteForDemo,
    resetProgress
  } = useAcademyStore();

  const [nameInput, setNameInput] = useState(userName);
  const [nameSaved, setNameSaved] = useState(false);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setUserName(nameInput.trim());
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  };

  const fundamentals = paths["monad-fundamentals"];
  const tokenized = paths["tokenized-assets"];
  const x402 = paths["x402-payments"];

  const fundamentalsPercent = Math.round((fundamentals.completedLessons.length / fundamentals.totalLessons) * 100);
  const tokenizedPercent = Math.round((tokenized.completedLessons.length / tokenized.totalLessons) * 100);
  const x402Percent = Math.round((x402.completedLessons.length / x402.totalLessons) * 100);

  const completedCount = [fundamentals.completed, tokenized.completed, x402.completed].filter(Boolean).length;
  const missingPaths = [];
  if (!fundamentals.completed) missingPaths.push("Monad Fundamentals");
  if (!tokenized.completed) missingPaths.push("Tokenized Assets");
  if (!x402.completed) missingPaths.push("x402 Payments");

  return (
    <div className="relative isolate min-h-screen flex flex-col justify-between font-sans bg-[#0e0e0f] text-white overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center space-x-2.5 mb-2">
                <span className="text-xs font-bold tracking-wider text-[#ccff00] uppercase bg-[#ccff00]/10 px-3 py-1 rounded-full border border-[#ccff00]/60">
                  MONAD ACADEMY DASHBOARD
                </span>
                <span className="text-xs text-white/50 font-medium">
                  {completedCount}/3 Paths Completed
                </span>
              </div>
              <h1 className="font-display uppercase text-white leading-[0.95] text-[clamp(1.9rem,4.6vw,3.4rem)]">
                Welcome back, {userName}!
              </h1>
              <p className="text-sm text-white/60 mt-1">
                Track your cross-path builder journey across Monad EVM, Tokenized Assets, and x402 Micropayments.
              </p>
            </div>

            {/* Quick Stats: XP & Streak */}
            <div className="flex items-center space-x-4">
              <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-sm text-center min-w-[110px]">
                <span className="text-xs font-medium text-white/40 block mb-0.5">Total XP</span>
                <span className="text-2xl font-black text-white flex items-center justify-center space-x-1">
                  <span>⚡</span>
                  <span>{totalXp}</span>
                </span>
              </div>

              <div className="bg-[#121214] border border-white/10 rounded-2xl p-4 shadow-sm text-center min-w-[110px]">
                <span className="text-xs font-medium text-white/40 block mb-0.5">Day Streak</span>
                <span className="text-2xl font-black text-amber-500 flex items-center justify-center space-x-1">
                  <span>🔥</span>
                  <span>{currentStreak}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Cross-Path Progress Widget Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-start">
            {/* Left 8 Cols: Cross-Path Progress Bars */}
            <div className="lg:col-span-8 bg-[#121214] rounded-3xl border border-white/10 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Cross-Path Progress Tracking
                  </h2>
                  <p className="text-xs text-white/50">
                    Complete all 3 paths to unlock your official Monad Scholar Certificate.
                  </p>
                </div>
                <span className="text-xs font-bold text-white font-mono bg-white/[0.06] px-3 py-1 rounded-full border border-white/10">
                  {completedCount === 3 ? "All Complete ✓" : `${completedCount}/3 Ready`}
                </span>
              </div>

              <div className="space-y-6">
                {/* Path 1: Monad Fundamentals */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#ccff00]/40 transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#ccff00] text-black font-black text-xs flex items-center justify-center shadow-sm">
                        1
                      </span>
                      <span className="text-sm font-bold text-white">
                        Monad Fundamentals
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-white/60">
                      {fundamentals.completedLessons.length}/{fundamentals.totalLessons} lessons ({fundamentalsPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-[#ccff00] rounded-full transition-all duration-500"
                      style={{ width: `${fundamentalsPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">
                      10k TPS • 300ms blocks • EVM compatibility • MonadVision
                    </span>
                    <Link
                      href="/learn/monad-fundamentals"
                      className="font-bold text-white hover:underline flex items-center space-x-1"
                    >
                      <span>{fundamentals.completed ? "Review Path" : "Continue"}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>

                {/* Path 2: Tokenized Assets */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#ccff00]/40 transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#ccff00] text-black font-black text-xs flex items-center justify-center shadow-sm">
                        2
                      </span>
                      <span className="text-sm font-bold text-white">
                        Tokenized Assets on Monad
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-white/60">
                      {tokenized.completedLessons.length}/{tokenized.totalLessons} lessons ({tokenizedPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-[#ccff00] rounded-full transition-all duration-500"
                      style={{ width: `${tokenizedPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">
                      RWAs • Equities • Treasuries • Custody & Compliance
                    </span>
                    <Link
                      href="/learn/tokenized-assets"
                      className="font-bold text-white hover:underline flex items-center space-x-1"
                    >
                      <span>{tokenized.completed ? "Review Path" : "Continue"}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>

                {/* Path 3: x402 Payments */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#ccff00]/40 transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#ccff00] text-black font-black text-xs flex items-center justify-center shadow-sm">
                        3
                      </span>
                      <span className="text-sm font-bold text-white">
                        x402 Payments on Monad
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-white/60">
                      {x402.completedLessons.length}/{x402.totalLessons} lessons ({x402Percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-[#ccff00] rounded-full transition-all duration-500"
                      style={{ width: `${x402Percent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">
                      HTTP 402 • AI Agent Payments • EIP-712 • Monad Facilitator
                    </span>
                    <Link
                      href="/learn/x402"
                      className="font-bold text-white hover:underline flex items-center space-x-1"
                    >
                      <span>{x402.completed ? "Review Path" : "Continue"}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Certificate Unlock Card (Marketplace Obsidian & Lime Aesthetic) */}
            <div className="lg:col-span-4">
              <div
                className={`rounded-3xl border p-6 sm:p-8 flex flex-col justify-between min-h-[380px] transition-all shadow-md ${
                  certificateEligible
                    ? "bg-[#0b0b0d] text-white border-white/10 shadow-xl"
                    : "bg-[#121214] text-white border-white/10"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider ${
                        certificateEligible
                          ? "bg-[#ccff00] text-black"
                          : "bg-white/[0.06] text-white/50"
                      }`}
                    >
                      {certificateEligible ? "UNLOCKED & READY" : "LOCKED"}
                    </span>
                    <span className="text-2xl">{certificateEligible ? "🏆" : "🔒"}</span>
                  </div>

                  <h3
                    className={`text-xl font-black tracking-tight mb-2 ${
                      certificateEligible ? "text-white" : "text-white"
                    }`}
                  >
                    Monad Scholar Certificate
                  </h3>

                  {certificateEligible ? (
                    <div className="space-y-3 text-xs text-white/60 leading-relaxed">
                      <p>
                        Congratulations! You have demonstrated mastery across all three Monad Academy curriculum paths.
                      </p>
                      <p className="text-[#ccff00] font-bold">
                        ✓ Certified Monad Builder Credential Ready
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs text-white/50 leading-relaxed">
                      <p>
                        Your official completion certificate unlocks automatically once all three curriculum paths are completed.
                      </p>
                      <div className="p-3 bg-white/[0.04] rounded-xl border border-white/10">
                        <span className="text-[11px] font-bold text-white/75 block mb-1">
                          Paths Remaining ({missingPaths.length}):
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-white/60">
                          {missingPaths.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-4 border-t border-white/10">
                  {certificateEligible ? (
                    <Link
                      href="/dashboard/certificate"
                      className="btn-neon btn-sm w-full py-3 px-4 text-xs font-bold text-center block shadow-md hover:shadow-lg transition-all"
                    >
                      View Your Certificate ↗
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 px-4 text-xs font-bold text-center block rounded-full bg-white/[0.06] text-white/40 cursor-not-allowed border border-white/10"
                    >
                      Complete All 3 Paths to Unlock
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Learner Settings & Instant Verification Sandbox */}
          <div className="bg-[#121214] rounded-3xl border border-white/10 p-6 sm:p-8 shadow-sm">
            <h3 className="text-xs font-bold text-white/40 mb-4 tracking-wider uppercase">
              LEARNER PROFILE & EVALUATION SANDBOX
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Form to update Name */}
              <form onSubmit={handleSaveName} className="space-y-2">
                <label className="block text-xs font-bold text-white/75">
                  Certificate Name:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your name..."
                    className="flex-1 bg-white/[0.04] text-white placeholder:text-white/30 rounded-xl border border-white/10 px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:border-[#ccff00]/60"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors"
                  >
                    {nameSaved ? "Saved ✓" : "Update Name"}
                  </button>
                </div>
                <span className="text-[10px] text-white/40 block">
                  This name will appear on your official Monad Scholar completion certificate.
                </span>
              </form>

              {/* Quick Evaluation Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => markPathComplete("monad-fundamentals")}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/85 text-xs font-bold hover:bg-white/15 transition-colors"
                >
                  Complete Path 1
                </button>

                <button
                  onClick={() => markPathComplete("tokenized-assets")}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/85 text-xs font-bold hover:bg-white/15 transition-colors"
                >
                  Complete Path 2
                </button>

                <button
                  onClick={() => markPathComplete("x402-payments")}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/85 text-xs font-bold hover:bg-white/15 transition-colors"
                >
                  Complete Path 3
                </button>

                <button
                  onClick={markAllCompleteForDemo}
                  className="px-4 py-2 rounded-xl bg-[#ccff00] text-black font-bold text-xs hover:bg-white transition-colors shadow-sm"
                >
                  Complete All (Unlock Certificate)
                </button>

                <button
                  onClick={resetProgress}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/15 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <SiteFooter note="Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated. Issued by Monad Academy." />
    </div>
  );
}
