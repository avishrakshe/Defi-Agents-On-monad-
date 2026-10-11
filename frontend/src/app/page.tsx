"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { HeroSection } from "../components/HeroSection";
import { AgentRegistry } from "../components/AgentRegistry";
import { TaskModal } from "../components/TaskModal";
import { AgentData, fetchLiveAgents } from "../lib/contracts";
import { scrollToId } from "../lib/smooth-scroll";

import { TaskConsole } from "../components/TaskConsole";
import { RegisterAgentModal } from "../components/RegisterAgentModal";
import { Manifesto } from "../components/Manifesto";
import { AgentLineup } from "../components/AgentLineup";
import { ProtocolLoop } from "../components/ProtocolLoop";
import { MonadEdge } from "../components/MonadEdge";
import { JoinCTA } from "../components/JoinCTA";
import { Sheet, SectionLabel, SplitHeading, Reveal, Marquee } from "../components/fx";

const TICKER = [
  "Agents pay agents",
  "x402 · HTTP 402 micropayments",
  "ERC-8004 identity + reputation",
  "300ms blocks",
  "$0.001 per call",
  "Zero LLM in the execution path",
  "Monad Testnet 10143"
];

export default function Home() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [initialTaskPrompt, setInitialTaskPrompt] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAgents = () => {
    fetchLiveAgents().then((data) => {
      setAgents(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleOpenTask = (prompt?: string) => {
    if (prompt) setInitialTaskPrompt(prompt);
    if (!scrollToId("task-console")) {
      setIsTaskModalOpen(true);
    }
  };

  const handleSelectAgent = (agent: AgentData) => {
    let p = "";
    if (agent.skill === "contract-audit") {
      p = "Audit contract 0x534b2f3A21130d7a60830c2Df862319e593943A3 for vulnerabilities";
    } else if (agent.skill === "token-risk-score") {
      p = "Evaluate token risk for 0x534b2f3A21130d7a60830c2Df862319e593943A3";
    } else if (agent.skill === "gas-timing") {
      p = "What is the current gas timing and congestion recommendation on Monad Testnet?";
    } else if (/whale|liquidity/i.test(agent.skill)) {
      p = "Track whale and liquidity moves for 0x534b2f3A21130d7a60830c2Df862319e593943A3";
    } else {
      p = `Monitor ${agent.name} for ${agent.skill} activity on Monad Testnet`;
    }
    setInitialTaskPrompt(p);

    // Glide to the task console
    if (!scrollToId("task-console")) {
      setIsTaskModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink overflow-x-clip">
      <Navbar onOpenTaskModal={() => handleOpenTask()} />

      <main>
        <HeroSection
          agents={agents}
          onRunClick={() => handleOpenTask("Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, and is gas good on Monad right now?")}
          onExploreClick={() => scrollToId("registry")}
        />

        {/* Ticker tape */}
        <div className="border-y-[1.5px] border-ink bg-sun">
          <Marquee items={TICKER} className="py-2.5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink" />
        </div>
        <AgentLineup agents={agents} onSelectAgent={handleSelectAgent} />

        <Manifesto />

        <ProtocolLoop />

        <Sheet id="task-console" tone="raised" className="py-20 sm:py-28">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-12 gap-8 items-end mb-10">
              <div className="lg:col-span-7">
                <SectionLabel index="03">Try it</SectionLabel>
                <SplitHeading
                  lines={["Run a task.", { text: "Watch it settle.", className: "italic text-violet" }]}
                  className="mt-6 font-display text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.92] tracking-[-0.02em]"
                />
              </div>
              <Reveal delay={0.2} className="lg:col-span-5">
                <p className="text-[17px] leading-relaxed text-ink-2 border-l-[1.5px] border-ink pl-5">
                  Ask in plain language. Each specialist is verified, paid per call in USDC and rated onchain — every line
                  item links to its transaction on MonadVision.
                </p>
              </Reveal>
            </div>
            <Reveal y={30}>
              <TaskConsole initialPrompt={initialTaskPrompt} />
            </Reveal>
          </div>
        </Sheet>

        <AgentRegistry
          agents={agents}
          onSelectAgent={handleSelectAgent}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
        />

        <MonadEdge />

        <JoinCTA onRegisterClick={() => setIsRegisterModalOpen(true)} />
      </main>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        initialPrompt={initialTaskPrompt}
        agents={agents}
      />

      <RegisterAgentModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onAgentRegistered={loadAgents}
      />
    </div>
  );
}
