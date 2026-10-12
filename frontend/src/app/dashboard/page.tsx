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
    <div className="relative isolate min-h-screen flex flex-col justify-between font-sans bg-paper text-ink overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center space-x-2.5 mb-2">
                <span className="text-xs font-bold tracking-wider text-violet uppercase bg-sun-soft px-3 py-1 rounded-full border border-ink">
                  MONAD ACADEMY DASHBOARD
                </span>
                <span className="text-xs text-ink-2 font-medium">
                  {completedCount}/3 Paths Completed
                </span>
              </div>
              <h1 className="font-display text-ink leading-[0.95] tracking-[-0.02em] text-[clamp(2.4rem,5.5vw,4.4rem)]">
                Welcome back, {userName}!
              </h1>
              <p className="text-sm text-ink-2 mt-1">
                Track your cross-path builder journey across Monad EVM, Tokenized Assets, and x402 Micropayments.
              </p>
            </div>

            {/* Quick Stats: XP & Streak */}
            <div className="flex items-center space-x-4">
              <div className="bg-paper-card border border-ink/20 rounded-none p-4 shadow-sm text-center min-w-[110px]">
                <span className="text-xs font-medium text-ink-3 block mb-0.5">Total XP</span>
                <span className="text-2xl font-black text-ink flex items-center justify-center space-x-1">
                  
                  <span>{totalXp}</span>
                </span>
              </div>

              <div className="bg-paper-card border border-ink/20 rounded-none p-4 shadow-sm text-center min-w-[110px]">
                <span className="text-xs font-medium text-ink-3 block mb-0.5">Day Streak</span>
                <span className="text-2xl font-black text-flame flex items-center justify-center space-x-1">
                  
                  <span>{currentStreak}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Cross-Path Progress Widget Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-start">
            {/* Left 8 Cols: Cross-Path Progress Bars */}
            <div className="lg:col-span-8 bg-paper-card rounded-none border border-ink/20 shadow-hard-sm p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-ink tracking-tight">
                    Cross-Path Progress Tracking
                  </h2>
                  <p className="text-xs text-ink-2">
                    Complete all 3 paths to unlock your official Monad Scholar Certificate.
                  </p>
                </div>
                <span className="text-xs font-bold text-ink font-mono bg-paper-shade px-3 py-1 rounded-full border border-ink/20">
                  {completedCount === 3 ? "All Complete ✓" : `${completedCount}/3 Ready`}
                </span>
              </div>

              <div className="space-y-6">
                {/* Path 1: Monad Fundamentals */}
                <div className="p-5 rounded-none bg-paper border border-ink/20 hover:border-ink transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-sun text-black font-black text-xs flex items-center justify-center shadow-sm">
                        1
                      </span>
                      <span className="text-sm font-bold text-ink">
                        Monad Fundamentals
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-ink-2">
                      {fundamentals.completedLessons.length}/{fundamentals.totalLessons} lessons ({fundamentalsPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-paper-shade rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-sun rounded-full transition-all duration-500"
                      style={{ width: `${fundamentalsPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">
                      10k TPS target • 300 ms blocks • 600 ms finality • EVM compatibility
                    </span>
                    <Link
                      href="/learn/monad-fundamentals"
                      className="font-bold text-ink hover:underline flex items-center space-x-1"
                    >
                      <span>{fundamentals.completed ? "Review Path" : "Continue"}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>

                {/* Path 2: Tokenized Assets */}
                <div className="p-5 rounded-none bg-paper border border-ink/20 hover:border-ink transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-sun text-black font-black text-xs flex items-center justify-center shadow-sm">
                        2
                      </span>
                      <span className="text-sm font-bold text-ink">
                        Tokenized Assets on Monad
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-ink-2">
                      {tokenized.completedLessons.length}/{tokenized.totalLessons} lessons ({tokenizedPercent}%)
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-paper-shade rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-sun rounded-full transition-all duration-500"
                      style={{ width: `${tokenizedPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">
                      RWAs • Equities • Treasuries • Custody & Compliance
                    </span>
                    <Link
                      href="/learn/tokenized-assets"
                      className="font-bold text-ink hover:underline flex items-center space-x-1"
                    >
                      <span>{tokenized.completed ? "Review Path" : "Continue"}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>

                {/* Path 3: x402 Payments */}
                <div className="p-5 rounded-none bg-paper border border-ink/20 hover:border-ink transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-full bg-sun text-black font-black text-xs flex items-center justify-center shadow-sm">
                        3
                      </span>
                      <span className="text-sm font-bold text-ink">
                        x402 Payments on Monad
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold text-ink-2">
                      {x402.completedLessons.length}/{x402.totalLessons} lessons ({x402Percent}%)
                    </span>
                  </div>

                  <div className="w-full h-2.5 bg-paper-shade rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-sun rounded-full transition-all duration-500"
                      style={{ width: `${x402Percent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">
                      HTTP 402 • AI Agent Payments • EIP-712 • Monad Facilitator
                    </span>
                    <Link
                      href="/learn/x402"
                      className="font-bold text-ink hover:underline flex items-center space-x-1"
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
                className={`rounded-none border p-6 sm:p-8 flex flex-col justify-between min-h-[380px] transition-all shadow-md ${
                  certificateEligible
                    ? "bg-paper-shade text-ink border-ink/20 shadow-xl"
                    : "bg-paper-card text-ink border-ink/20"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider ${
                        certificateEligible
                          ? "bg-sun text-black"
                          : "bg-paper-shade text-ink-2"
                      }`}
                    >
                      {certificateEligible ? "UNLOCKED & READY" : "LOCKED"}
                    </span>
                    <span className="text-2xl">{certificateEligible ? "✓" : "§"}</span>
                  </div>

                  <h3
                    className={`text-xl font-black tracking-tight mb-2 ${
                      certificateEligible ? "text-ink" : "text-ink"
                    }`}
                  >
                    Monad Scholar Certificate
                  </h3>

                  {certificateEligible ? (
                    <div className="space-y-3 text-xs text-ink-2 leading-relaxed">
                      <p>
                        Congratulations! You have demonstrated mastery across all three Monad Academy curriculum paths.
                      </p>
                      <p className="text-violet font-bold">
                        ✓ Certified Monad Builder Credential Ready
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs text-ink-2 leading-relaxed">
                      <p>
                        Your official completion certificate unlocks automatically once all three curriculum paths are completed.
                      </p>
                      <div className="p-3 bg-paper rounded-none border border-ink/20">
                        <span className="text-[11px] font-bold text-ink block mb-1">
                          Paths Remaining ({missingPaths.length}):
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-ink-2">
                          {missingPaths.map((p, idx) => (
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-4 border-t border-ink/20">
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
                      className="w-full py-3 px-4 text-xs font-bold text-center block rounded-full bg-paper-shade text-ink-3 cursor-not-allowed border border-ink/20"
                    >
                      Complete All 3 Paths to Unlock
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Learner Settings & Instant Verification Sandbox */}
          <div className="bg-paper-card rounded-none border border-ink/20 p-6 sm:p-8 shadow-sm">
            <h3 className="text-xs font-bold text-ink-3 mb-4 tracking-wider uppercase">
              LEARNER PROFILE & EVALUATION SANDBOX
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Form to update Name */}
              <form onSubmit={handleSaveName} className="space-y-2">
                <label className="block text-xs font-bold text-ink">
                  Certificate Name:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your name..."
                    className="flex-1 bg-paper text-ink placeholder:text-ink-3 rounded-none border border-ink/20 px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet focus:border-ink"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-none bg-paper-shade text-ink text-xs font-bold hover:bg-paper-deep transition-colors"
                  >
                    {nameSaved ? "Saved ✓" : "Update Name"}
                  </button>
                </div>
                <span className="text-[10px] text-ink-3 block">
                  This name will appear on your official Monad Scholar completion certificate.
                </span>
              </form>

              {/* Quick Evaluation Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => markPathComplete("monad-fundamentals")}
                  className="px-3.5 py-2 rounded-none bg-paper-shade border border-ink/20 text-ink text-xs font-bold hover:bg-paper-deep transition-colors"
                >
                  Complete Path 1
                </button>

                <button
                  onClick={() => markPathComplete("tokenized-assets")}
                  className="px-3.5 py-2 rounded-none bg-paper-shade border border-ink/20 text-ink text-xs font-bold hover:bg-paper-deep transition-colors"
                >
                  Complete Path 2
                </button>

                <button
                  onClick={() => markPathComplete("x402-payments")}
                  className="px-3.5 py-2 rounded-none bg-paper-shade border border-ink/20 text-ink text-xs font-bold hover:bg-paper-deep transition-colors"
                >
                  Complete Path 3
                </button>

                <button
                  onClick={markAllCompleteForDemo}
                  className="px-4 py-2 rounded-none bg-sun text-black font-bold text-xs hover:bg-sun-soft transition-colors shadow-sm"
                >
                  Complete All (Unlock Certificate)
                </button>

                <button
                  onClick={resetProgress}
                  className="px-3.5 py-2 rounded-none bg-paper-shade border border-ink/20 text-ink-2 text-xs font-semibold hover:bg-paper-deep transition-colors"
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
