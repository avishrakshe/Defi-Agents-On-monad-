"use client";

import React from "react";
import Link from "next/link";
import { Navbar } from "../../components/Navbar";
import { PageBackdrop, SiteFooter } from "../../components/PageChrome";
import { useAcademyStore } from "../../lib/progress-store";

export default function LearnCatalogPage() {
  const { paths } = useAcademyStore();

  const courses = [
    {
      id: "monad-fundamentals" as const,
      title: "Monad Fundamentals",
      category: "Layer-1 EVM Architecture",
      badge: "Core Track",
      description: "Master Monad's high-performance parallel execution, 10,000 TPS, 300ms block times, 600ms finality, and deploy your first Solidity contract.",
      modules: 5,
      xp: 250,
      topics: ["What is Monad?", "Why Monad is Fast", "Monad for EVM Devs", "First Testnet Tx", "Solidity Contract Lab"],
      href: "/learn/monad-fundamentals"
    },
    {
      id: "tokenized-assets" as const,
      title: "Tokenized Assets on Monad",
      category: "RWAs & Capital Markets",
      badge: "Institutional DeFi",
      description: "Learn how real-world financial assets (equities, treasuries, private credit) are tokenized, permissioned, compliant, and settled with instant finality.",
      modules: 5,
      xp: 250,
      topics: ["What are RWAs?", "The Asset Lifecycle", "Tokenized Stocks", "Treasury Yield Models", "Compliance & Whitelisting"],
      href: "/learn/tokenized-assets"
    },
    {
      id: "x402-payments" as const,
      title: "x402 Payments on Monad",
      category: "Autonomous Agent Protocols",
      badge: "AI Agent Rails",
      description: "Build pay-per-request APIs and autonomous AI agent marketplaces using the HTTP 402 Payment Required standard and Monad USDC micropayments.",
      modules: 5,
      xp: 250,
      topics: ["HTTP 402 Standard", "Request Lifecycle", "Payable API Route", "Monad Facilitator", "Autonomous Agent Marketplaces"],
      href: "/learn/x402"
    }
  ];

  return (
    <div className="relative isolate min-h-screen flex flex-col justify-between font-sans bg-paper text-ink overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center space-x-2.5 mb-2">
                <span className="text-xs font-bold tracking-wider text-violet uppercase bg-sun-soft px-3 py-1 rounded-full border border-ink">
                  MONAD ACADEMY CURRICULUM
                </span>
                <span className="text-xs text-ink-2 font-medium">
                  3 Builder Paths
                </span>
              </div>
              <h1 className="font-display text-ink leading-[0.95] tracking-[-0.02em] text-[clamp(2.4rem,5.5vw,4.4rem)]">
                Understand Monad. Build at Internet Speed.
              </h1>
              <p className="text-base text-ink-2 mt-1 max-w-2xl">
                Hands-on developer modules with interactive docs, live contextual quizzes, onchain testnet transactions, and an official scholar certificate.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard"
                className="btn-neon btn-sm text-xs sm:text-sm font-bold py-3 px-6 shadow-sm hover:shadow-md transition-all"
              >
                Go to My Dashboard →
              </Link>
            </div>
          </div>

          {/* Course Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {courses.map((course) => {
              const pathProgress = paths[course.id];
              const percent = Math.round((pathProgress.completedLessons.length / pathProgress.totalLessons) * 100);

              return (
                <div
                  key={course.id}
                  className="bg-paper-card rounded-none border border-ink/20 shadow-hard-sm p-6 sm:p-8 flex flex-col justify-between hover:border-ink hover:shadow-md transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-paper-shade text-ink border border-ink/20">
                        {course.badge}
                      </span>
                      <span className="text-xs font-mono font-bold text-ink">
                        +{course.xp} XP
                      </span>
                    </div>

                    <h2 className="text-xl font-extrabold text-ink group-hover:text-violet transition-colors tracking-tight mb-1 leading-snug">
                      {course.title}
                    </h2>
                    <span className="text-xs font-mono text-ink-3 block mb-4">
                      {course.category}
                    </span>

                    <p className="text-xs text-ink-2 leading-relaxed mb-6">
                      {course.description}
                    </p>

                    <div className="mb-6 pt-4 border-t border-ink/20">
                      <span className="text-[10px] font-bold uppercase text-ink-3 block mb-2 tracking-wider">
                        Syllabus Highlights:
                      </span>
                      <ul className="space-y-1 text-xs text-ink font-medium">
                        {course.topics.map((t, idx) => (
                          <li key={idx} className="flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-sun border border-black/30"></span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] text-ink-2 font-medium mb-1">
                        <span>{pathProgress.completedLessons.length}/{pathProgress.totalLessons} Lessons</span>
                        <span className="font-mono">{percent}% Complete</span>
                      </div>
                      <div className="w-full h-2 bg-paper-shade rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sun rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>

                    <Link
                      href={course.href}
                      className={`w-full py-2.5 rounded-full font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-sm ${
                        pathProgress.completed
                          ? "bg-paper-shade text-ink hover:bg-paper-deep"
                          : "btn-neon btn-sm"
                      }`}
                    >
                      <span>{pathProgress.completed ? "Review Course" : percent > 0 ? "Continue Learning" : "Start Course"}</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      <SiteFooter note="Built for the Monad ecosystem. Not an official Monad Labs product unless otherwise stated. Issued by Monad Academy." />
    </div>
  );
}
