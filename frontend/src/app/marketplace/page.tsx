"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../../components/Navbar";
import { PageBackdrop, SiteFooter } from "../../components/PageChrome";
import { AgentRegistry } from "../../components/AgentRegistry";
import { TaskModal } from "../../components/TaskModal";
import { AgentData, fetchLiveAgents } from "../../lib/contracts";

export default function MarketplacePage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [initialTaskPrompt, setInitialTaskPrompt] = useState("");

  useEffect(() => {
    fetchLiveAgents().then(setAgents);
  }, []);

  const handleSelectAgent = (agent: AgentData) => {
    setInitialTaskPrompt(`Execute analysis with ${agent.name} on contract 0x534b2f3A21130d7a60830c2Df862319e593943A3`);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="relative isolate min-h-screen flex flex-col justify-between bg-[#0e0e0f] text-white overflow-x-clip">
      <PageBackdrop />
      <div>
        <Navbar onOpenTaskModal={() => setIsTaskModalOpen(true)} />
        <main className="pt-20">
          <AgentRegistry agents={agents} onSelectAgent={handleSelectAgent} />
        </main>
      </div>
      <SiteFooter />

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        initialPrompt={initialTaskPrompt}
        agents={agents}
      />
    </div>
  );
}
