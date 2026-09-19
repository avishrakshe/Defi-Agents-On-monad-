"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../components/Navbar";
import { HeroSection } from "../components/HeroSection";
import { AgentRegistry } from "../components/AgentRegistry";
import { TaskModal } from "../components/TaskModal";
import { AgentData, fetchLiveAgents } from "../lib/contracts";

import { TaskConsole } from "../components/TaskConsole";
import { RegisterAgentModal } from "../components/RegisterAgentModal";

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
    const el = document.getElementById("task-console");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
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
    } else {
      p = `Monitor ${agent.name} for ${agent.skill} activity on Monad Testnet`;
    }
    setInitialTaskPrompt(p);
    
    // Also scroll smoothly to the task console and focus it
    const el = document.getElementById("task-console");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      setIsTaskModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Navbar onOpenTaskModal={() => handleOpenTask()} />

        <main>
          <HeroSection
            agents={agents}
            onRunClick={() => handleOpenTask("Is token 0x534b2f3A21130d7a60830c2Df862319e593943A3 safe, and is gas good on Monad right now?")}
          />

          <section id="task-console">
            <TaskConsole />
          </section>

          <div id="registry">
            <AgentRegistry
              agents={agents}
              onSelectAgent={handleSelectAgent}
              onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            />
          </div>
        </main>
      </div>

      <footer className="border-t border-gray-200/80 py-8 px-4 sm:px-8 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#ccff00] inline-flex items-center justify-center font-bold text-black text-[10px]">
              D
            </span>
            <span className="font-semibold text-gray-700">DeFi Agent Marketplace</span>
            <span>• Monad Testnet (Chain ID 10143)</span>
          </div>

          <div className="flex items-center space-x-6">
            <a href="https://testnet.monadvision.com" target="_blank" rel="noreferrer" className="hover:text-gray-600 transition-colors">
              MonadVision
            </a>
            <a href="https://testnet.monadscan.com" target="_blank" rel="noreferrer" className="hover:text-gray-600 transition-colors">
              Monadscan
            </a>
            <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="hover:text-gray-600 transition-colors">
              Faucet
            </a>
          </div>
        </div>
      </footer>

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
