"use client";

import React from "react";
import { AgentData } from "../lib/contracts";
import { TaskConsole } from "./TaskConsole";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  agents: AgentData[];
}

/**
 * Modal shell around the same TaskConsole used inline, so there is exactly one execution path
 * (402 round trip, per-agent payee, callId-bound reviews) wherever a task is launched from.
 */
export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, initialPrompt = "" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-paper-card rounded-none border border-ink/20 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 relative" data-lenis-prevent>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-paper-shade hover:bg-paper-deep flex items-center justify-center text-ink-2 font-bold transition-colors"
        >
          ✕
        </button>
        <div className="mb-4 pr-12">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-3">Task Orchestration Engine</span>
          <h2 className="text-2xl font-black text-ink tracking-tight">Run a DeFi task</h2>
        </div>
        <TaskConsole initialPrompt={initialPrompt} />
      </div>
    </div>
  );
};
