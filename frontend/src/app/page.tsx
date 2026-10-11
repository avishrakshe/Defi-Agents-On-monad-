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
    // Lime frame: dark sheets rise over it as the page scrolls
    <div className="min-h-screen bg-[#ccff00] overflow-x-clip">
      <Navbar overlay onOpenTaskModal={() => handleOpenTask()} />

      <main>
        <HeroSection
          agents={agents}
          onRunClick={() => handleOpenTask("Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, and is gas good on Monad right now?")}
          onExploreClick={() => scrollToId("registry")}
        />

        {/* Tilted ticker band bridging hero and manifesto */}
        <div className="relative z-20 -my-6 py-1 -rotate-[1.6deg] scale-[1.03] bg-black border-y-2 border-[#ccff00]">
          <Marquee
            items={TICKER}
            className="py-3 font-display uppercase text-sm sm:text-base tracking-wider text-[#ccff00]"
          />
        </div>

        <AgentLineup agents={agents} onSelectAgent={handleSelectAgent} />

        <Manifesto />

        <ProtocolLoop />

        <Sheet id="task-console" tone="raised" className="pt-24 pb-28 sm:pt-32 sm:pb-32">
          <div aria-hidden="true" className="absolute inset-0 bg-blueprint" />
          <div aria-hidden="true" className="absolute -right-40 top-10 w-[520px] h-[520px] rounded-full bg-[#6d28d9] opacity-30 blur-[130px]" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-8">
            <div className="grid lg:grid-cols-12 gap-8 items-end mb-12">
              <div className="lg:col-span-8">
                <SectionLabel index="002">Command deck</SectionLabel>
                <SplitHeading
                  lines={["Run a task.", { text: "Watch it settle.", className: "text-[#ccff00]" }]}
                  className="mt-8 font-display uppercase text-[clamp(2.4rem,6vw,5rem)] leading-[0.95]"
                />
              </div>
              <Reveal delay={0.2} className="lg:col-span-4">
                <p className="font-mono text-sm uppercase leading-relaxed text-white/50">
                  Ask in plain language. Specialists are verified, paid per call and rated onchain — every hash
                  links to MonadVision.
                </p>
              </Reveal>
            </div>
            <Reveal y={40}>
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
