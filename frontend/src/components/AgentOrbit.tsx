"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AgentData } from "../lib/contracts";
import { AgentPortrait, variantForSkill } from "./AgentPortrait";

interface AgentOrbitProps {
  agents: AgentData[];
}

// Node anchor points in the 500×500 SVG space (mirrored as % for the HTML cards)
const NODES = [
  { skill: "contract-audit", label: "Contract Auditor", x: 92, y: 112 },
  { skill: "token-risk-score", label: "Token Risk Scorer", x: 418, y: 210 },
  { skill: "gas-timing", label: "Gas & Timing", x: 132, y: 404 }
] as const;

const C = 250;

/**
 * AgentOrbit — live visualisation of the marketplace: the orchestrator core streams
 * x402 payment packets (lime) to each specialist and receives verified results (violet).
 * Reputation values on each node come straight from the onchain registry.
 */
export const AgentOrbit: React.FC<AgentOrbitProps> = ({ agents }) => {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-full aspect-square max-w-[560px] mx-auto select-none">
      <svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ccff00" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ccff00" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ccff00" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#836ef9" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Rotating orbit rings */}
        <g className="animate-spin-slow" style={{ transformOrigin: "250px 250px" }}>
          <circle cx={C} cy={C} r={200} fill="none" stroke="rgba(255,255,255,0.10)" strokeDasharray="2 10" />
          <circle cx={C} cy={C} r={232} fill="none" stroke="rgba(204,255,0,0.18)" strokeDasharray="60 18 4 18" />
          <circle cx={C + 200} cy={C} r={4} fill="#ccff00" />
          <circle cx={C - 232} cy={C} r={3} fill="#836ef9" />
        </g>
        <g className="animate-spin-slow" style={{ transformOrigin: "250px 250px", animationDirection: "reverse", animationDuration: "26s" }}>
          <circle cx={C} cy={C} r={150} fill="none" stroke="rgba(131,110,249,0.28)" strokeDasharray="1 7" />
          <circle cx={C} cy={C - 150} r={3} fill="#e8ff80" />
        </g>

        {/* Beams from the core to each specialist */}
        {NODES.map((n) => (
          <line key={n.skill} x1={C} y1={C} x2={n.x} y2={n.y} stroke="url(#beam)" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 5" />
        ))}

        {/* Payment packets out (lime) and results back (violet) */}
        {!reduce &&
          NODES.map((n, i) => (
            <React.Fragment key={`p-${n.skill}`}>
              <motion.circle
                r={4}
                fill="#ccff00"
                style={{ filter: "drop-shadow(0 0 6px #ccff00)" }}
                initial={{ cx: C, cy: C, opacity: 0 }}
                animate={{ cx: [C, n.x], cy: [C, n.y], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, delay: i * 0.9, ease: "easeInOut" }}
              />
              <motion.circle
                r={3}
                fill="#a594ff"
                style={{ filter: "drop-shadow(0 0 6px #836ef9)" }}
                initial={{ cx: n.x, cy: n.y, opacity: 0 }}
                animate={{ cx: [n.x, C], cy: [n.y, C], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.4, delay: i * 0.9 + 1.5, ease: "easeInOut" }}
              />
            </React.Fragment>
          ))}

        {/* Core */}
        <circle cx={C} cy={C} r={110} fill="url(#coreGlow)" />
        {!reduce && (
          <motion.circle
            cx={C}
            cy={C}
            r={58}
            fill="none"
            stroke="#ccff00"
            strokeWidth="1"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: [1, 1.9], opacity: [0.7, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
            style={{ transformOrigin: "250px 250px" }}
          />
        )}
        <polygon
          points={hexPoints(C, C, 58)}
          fill="#0e0e0f"
          stroke="#ccff00"
          strokeWidth="1.5"
        />
        <polygon points={hexPoints(C, C, 46)} fill="#ccff00" />
        <text x={C} y={C - 4} textAnchor="middle" className="font-display" fontSize="22" fill="#0b0b0b">
          x402
        </text>
        <text x={C} y={C + 16} textAnchor="middle" className="font-mono" fontSize="8.5" letterSpacing="1.5" fill="#0b0b0b">
          ORCHESTRATOR
        </text>
      </svg>

      {/* Specialist node cards (HTML for crisp text) */}
      {NODES.map((n, i) => {
        const agent = agents.find((a) => a.skill === n.skill);
        const hasScore = agent && agent.feedbackCount > 0;
        return (
          <motion.div
            key={n.skill}
            initial={reduce ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.15, type: "spring", stiffness: 180, damping: 16 }}
            className="absolute"
            style={{
              left: `${(n.x / 500) * 100}%`,
              top: `${(n.y / 500) * 100}%`,
              x: "-50%",
              y: "-50%"
            }}
          >
            <div className={`animate-float`} style={{ animationDelay: `${i * -2}s` }}>
              <div className="clip-chamfer bg-[#ccff00]/90 p-px">
                <div className="clip-chamfer bg-[#0e0e0f]/95 backdrop-blur px-3 py-2.5 sm:px-4 sm:py-3 min-w-[128px] sm:min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2a2a30] to-[#0b0b0e] border border-[#ccff00]/40 overflow-hidden flex items-end justify-center">
                      <AgentPortrait variant={variantForSkill(n.skill)} crop="head" className="w-full h-full" />
                    </span>
                    <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider text-white/70 leading-tight">
                      {n.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className={`font-display text-xl sm:text-2xl leading-none ${hasScore ? "text-[#ccff00]" : "text-white/40"}`}>
                      {hasScore ? agent!.avgScore : "—"}
                      {hasScore && <span className="text-xs text-white/40">/100</span>}
                    </span>
                    <span className="font-mono text-[9px] text-white/40 uppercase">
                      {hasScore ? `${agent!.feedbackCount} fb` : "no reviews"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}
