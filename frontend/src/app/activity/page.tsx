"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "../../components/Navbar";

interface ActivityItem {
  id: string;
  agentName: string;
  skill: string;
  targetAddress?: string;
  mode: string;
  status: "settled" | "executed";
  txHash: string;
  costUSDC: string;
  timestamp: string;
}

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: "act_1",
      agentName: "Token Risk Scorer",
      skill: "token-risk-score",
      targetAddress: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
      mode: "Autonomous (Mode A)",
      status: "settled",
      txHash: "0xsim_1a0b875cf8b_410d6d",
      costUSDC: "0.001 tUSDC",
      timestamp: "Just now"
    },
    {
      id: "act_2",
      agentName: "Gas Price & Transaction Timing Agent",
      skill: "gas-timing",
      mode: "Autonomous (Mode A)",
      status: "settled",
      txHash: "0xsim_1a0b875ddbd_1bb524",
      costUSDC: "0.001 tUSDC",
      timestamp: "Just now"
    },
    {
      id: "act_3",
      agentName: "Smart Contract Auditor",
      skill: "contract-audit",
      targetAddress: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
      mode: "Client Signed (Mode B)",
      status: "settled",
      txHash: "0xsim_1a0b873347f_18da44",
      costUSDC: "0.001 tUSDC",
      timestamp: "5 mins ago"
    }
  ]);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <Navbar />

        <main className="py-10 px-4 sm:px-8 max-w-7xl mx-auto">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-6 sm:p-10">
            <div className="mb-8">
              <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                ONCHAIN ACTIVITY FEED
              </span>
              <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight mt-1">
                Recent Agent Executions & Settlements
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Real-time log of micropayments and task executions settled on Monad Testnet.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Agent</th>
                    <th className="pb-3">Skill</th>
                    <th className="pb-3">Target Address</th>
                    <th className="pb-3">Mode</th>
                    <th className="pb-3">Tx / Settlement Hash</th>
                    <th className="pb-3">Cost</th>
                    <th className="pb-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 font-bold text-gray-900">{act.agentName}</td>
                      <td className="py-4 font-mono text-gray-500">
                        <span className="bg-gray-100 px-2 py-0.5 rounded-md text-[11px]">
                          {act.skill}
                        </span>
                      </td>
                      <td className="py-4 font-mono text-gray-600">
                        {act.targetAddress ? `${act.targetAddress.slice(0, 6)}...${act.targetAddress.slice(-4)}` : "—"}
                      </td>
                      <td className="py-4 text-gray-700">{act.mode}</td>
                      <td className="py-4 font-mono text-gray-500">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                          {act.txHash.slice(0, 14)}...
                        </span>
                      </td>
                      <td className="py-4 font-bold text-gray-900">{act.costUSDC}</td>
                      <td className="py-4 text-right text-gray-400">{act.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
