"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../../components/Navbar";
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
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Navbar onOpenTaskModal={() => setIsTaskModalOpen(true)} />
        <main className="py-8">
          <AgentRegistry agents={agents} onSelectAgent={handleSelectAgent} />
        </main>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        initialPrompt={initialTaskPrompt}
        agents={agents}
      />
    </div>
  );
}
