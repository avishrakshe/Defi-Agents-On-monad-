"use client";

import React, { useId } from "react";

export type PortraitVariant = "auditor" | "risk" | "gas" | "whale" | "generic";

interface AgentPortraitProps {
  variant: PortraitVariant;
  /** "full" = head + shoulders bust, "head" = tight avatar crop */
  crop?: "full" | "head";
  className?: string;
  animated?: boolean;
}

const INK = "#16130F";
const PAPER = "#FBF8F2";

// Each agent is printed with one main spot ink plus an offset second plate
const INKS: Record<PortraitVariant, { spot: string; soft: string; plate: string; eye: string }> = {
  auditor: { spot: "#5B3DF5", soft: "#E4DEFF", plate: "#FF5A1F", eye: "#F2B705" },
  risk: { spot: "#FF5A1F", soft: "#FFE1D3", plate: "#5B3DF5", eye: "#FBF8F2" },
  gas: { spot: "#F2B705", soft: "#FCEFC2", plate: "#FF5A1F", eye: "#FF5A1F" },
  whale: { spot: "#1E7A46", soft: "#D8EEDF", plate: "#5B3DF5", eye: "#FBF8F2" },
  generic: { spot: "#5B3DF5", soft: "#E4DEFF", plate: "#FF5A1F", eye: "#F2B705" }
};

/**
 * Risograph-style agent bust: flat ink linework, halftone fills and a misregistered second plate.
 * Pure SVG — razor sharp at any size (4K and beyond) and a few KB.
 */
export const AgentPortrait: React.FC<AgentPortraitProps> = ({ variant, crop = "full", className = "", animated = true }) => {
  const { spot, soft, plate, eye } = INKS[variant];
  const id = `rp-${variant}-${useId().replace(/:/g, "")}`;
  const viewBox = crop === "head" ? "62 58 276 276" : "0 0 400 480";
  const isWhale = variant === "whale";
  const head = isWhale ? { x: 92, y: 78, w: 216, h: 236, rx: 104 } : { x: 96, y: 92, w: 208, h: 220, rx: 72 };
  const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  const torsoPath = "M30 480 C 34 404, 92 362, 150 354 L 250 354 C 308 362, 366 404, 370 480 Z";

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={`${variant} agent portrait`} preserveAspectRatio="xMidYMax meet">
      <defs>
        <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <rect width="9" height="9" fill={soft} />
          <circle cx="4.5" cy="4.5" r="2.1" fill={spot} />
        </pattern>
        <pattern id={`${id}-fine`} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.1" fill={INK} opacity="0.55" />
        </pattern>
      </defs>

      {/* Misregistered second plate — the riso "offset" */}
      <g opacity="0.85" style={{ mixBlendMode: "multiply" }} transform="translate(9 7)">
        <path d={torsoPath} fill={plate} />
        <rect x={head.x} y={head.y} width={head.w} height={head.h} rx={head.rx} fill={plate} />
      </g>

      {/* ---------- Torso ---------- */}
      <path d={torsoPath} fill={spot} {...stroke} />
      <path d="M140 386 L 260 386 L 248 466 L 152 466 Z" fill={PAPER} {...stroke} />
      <Emblem variant={variant} />
      {/* Shoulder seams */}
      <path d="M62 440 C 74 410, 98 392, 132 384" fill="none" {...stroke} />
      <path d="M338 440 C 326 410, 302 392, 268 384" fill="none" {...stroke} />

      {/* ---------- Neck ---------- */}
      <rect x="168" y="296" width="64" height="66" fill={PAPER} {...stroke} />
      {[314, 332].map((y) => (
        <line key={y} x1="168" y1={y} x2="232" y2={y} {...stroke} strokeWidth={3} />
      ))}

      {/* ---------- Ear modules ---------- */}
      {[head.x - 4, head.x + head.w + 4].map((cx, i) => (
        <g key={i}>
          <circle cx={cx} cy="212" r="30" fill={PAPER} {...stroke} />
          <circle cx={cx} cy="212" r="14" fill={spot} {...stroke} strokeWidth={3}>
            {animated && <animate attributeName="r" values="14;10;14" dur="2.6s" begin={`${i * 0.7}s`} repeatCount="indefinite" />}
          </circle>
        </g>
      ))}

      {/* ---------- Head ---------- */}
      <rect x={head.x} y={head.y} width={head.w} height={head.h} rx={head.rx} fill={`url(#${id}-dots)`} {...stroke} />
      {/* Hatched shadow on the right cheek */}
      <path
        d={`M${head.x + head.w - 34} ${head.y + 50} Q ${head.x + head.w - 6} ${head.y + head.h / 2} ${head.x + head.w - 34} ${head.y + head.h - 40}`}
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeDasharray="2 7"
      />

      <HeadGear variant={variant} spot={spot} head={head} animated={animated} />

      {/* ---------- Visor ---------- */}
      <rect x="118" y="164" width="164" height="80" rx="38" fill={INK} {...stroke} />
      <Eyes variant={variant} eye={eye} spot={spot} animated={animated} />
      <path d="M140 176 Q 160 170 182 172" fill="none" stroke={PAPER} strokeWidth="4" strokeLinecap="round" opacity="0.8" />

      {/* Mouth */}
      <path d="M176 276 Q 200 290 224 276" fill="none" {...stroke} />
    </svg>
  );
};

/* ------------------------------------------------------------------ */

const Eyes: React.FC<{ variant: PortraitVariant; eye: string; spot: string; animated: boolean }> = ({ variant, eye, spot, animated }) => {
  const blink = animated ? <animate attributeName="opacity" values="1;1;0;1" keyTimes="0;0.9;0.94;1" dur="4.5s" repeatCount="indefinite" /> : null;

  switch (variant) {
    case "auditor":
      return (
        <g>
          <rect x="150" y="192" width="26" height="22" fill={eye}>{blink}</rect>
          <rect x="224" y="192" width="26" height="22" fill={eye}>{blink}</rect>
          <circle cx="237" cy="203" r="24" fill="none" stroke={PAPER} strokeWidth="3" />
        </g>
      );
    case "risk":
      return (
        <g>
          <circle cx="200" cy="204" r="28" fill="none" stroke={PAPER} strokeWidth="2" strokeDasharray="4 5">
            {animated && <animateTransform attributeName="transform" type="rotate" values="0 200 204;360 200 204" dur="8s" repeatCount="indefinite" />}
          </circle>
          <circle cx="200" cy="204" r="16" fill={spot}>{blink}</circle>
          <path d="M200 176 V 232 M 172 204 H 228" stroke={PAPER} strokeWidth="2" />
        </g>
      );
    case "gas":
      return (
        <g>
          {Array.from({ length: 8 }).map((_, i) => (
            <rect key={i} x={148 + i * 13} y="196" width="9" height="16" fill={eye}>
              {animated && <animate attributeName="opacity" values="0.2;1;0.2" dur="1.6s" begin={`${i * 0.12}s`} repeatCount="indefinite" />}
            </rect>
          ))}
        </g>
      );
    case "whale":
      return (
        <g>
          <path d="M136 206 Q 152 190 168 206 T 200 206 T 232 206 T 264 206" fill="none" stroke={eye} strokeWidth="6" strokeLinecap="round">
            {animated && (
              <animate
                attributeName="d"
                values="M136 206 Q 152 190 168 206 T 200 206 T 232 206 T 264 206;M136 206 Q 152 222 168 206 T 200 206 T 232 206 T 264 206;M136 206 Q 152 190 168 206 T 200 206 T 232 206 T 264 206"
                dur="3s"
                repeatCount="indefinite"
              />
            )}
          </path>
        </g>
      );
    default:
      return (
        <g>
          <circle cx="168" cy="204" r="12" fill={eye}>{blink}</circle>
          <circle cx="232" cy="204" r="12" fill={eye}>{blink}</circle>
        </g>
      );
  }
};

const HeadGear: React.FC<{ variant: PortraitVariant; spot: string; head: { x: number; y: number; w: number; h: number }; animated: boolean }> = ({
  variant,
  spot,
  head,
  animated
}) => {
  const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (variant) {
    case "auditor":
      return (
        <g>
          <path d={`M186 ${head.y + 2} L 214 ${head.y + 2} L 208 ${head.y - 34} L 192 ${head.y - 34} Z`} fill={spot} {...stroke} />
          <path d="M200 116 l 16 6 v 12 c 0 10 -8 16 -16 20 c -8 -4 -16 -10 -16 -20 v -12 z" fill={PAPER} {...stroke} strokeWidth={3} />
          <path d="M193 133 l 5 5 l 10 -10" fill="none" {...stroke} strokeWidth={3} />
        </g>
      );
    case "risk":
      return (
        <g>
          <path d={`M262 ${head.y + 14} L 286 ${head.y - 22}`} {...stroke} />
          <path d={`M268 ${head.y - 40} Q 300 ${head.y - 52} 314 ${head.y - 20} Z`} fill={PAPER} {...stroke} />
          <circle cx="292" cy={head.y - 30} r="6" fill={spot} {...stroke} strokeWidth={2}>
            {animated && <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />}
          </circle>
        </g>
      );
    case "gas":
      return (
        <g>
          <path d="M160 150 A 40 40 0 0 1 240 150 Z" fill={PAPER} {...stroke} strokeWidth={3} />
          {[-60, -30, 0, 30, 60].map((a) => (
            <line key={a} x1="200" y1="114" x2="200" y2="121" stroke={INK} strokeWidth="2.5" transform={`rotate(${a} 200 150)`} />
          ))}
          <line x1="200" y1="150" x2="200" y2="124" stroke="#FF5A1F" strokeWidth="4" strokeLinecap="round">
            {animated && <animateTransform attributeName="transform" type="rotate" values="-50 200 150; 40 200 150; -10 200 150; -50 200 150" dur="4s" repeatCount="indefinite" />}
          </line>
          <circle cx="200" cy="150" r="4" fill={INK} />
        </g>
      );
    case "whale":
      return (
        <g>
          <path d={`M188 ${head.y + 6} Q 204 ${head.y - 40} 230 ${head.y - 46} Q 214 ${head.y - 18} 214 ${head.y + 6} Z`} fill={spot} {...stroke} />
          {animated &&
            [0, 1].map((i) => (
              <circle key={i} cx="206" cy={head.y - 22} r="10" fill="none" stroke={INK} strokeWidth="2.5">
                <animate attributeName="r" values="8;46" dur="2.6s" begin={`${i * 1.3}s`} repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.9;0" dur="2.6s" begin={`${i * 1.3}s`} repeatCount="indefinite" />
              </circle>
            ))}
        </g>
      );
    default:
      return <line x1="200" y1={head.y} x2="200" y2={head.y - 28} {...stroke} />;
  }
};

const Emblem: React.FC<{ variant: PortraitVariant }> = ({ variant }) => {
  const s = { fill: "none", stroke: INK, strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (variant) {
    case "auditor":
      return <path d="M200 404 l 18 7 v 14 c 0 12 -9 19 -18 23 c -9 -4 -18 -11 -18 -23 v -14 z" {...s} />;
    case "risk":
      return (
        <g {...s}>
          <path d="M200 404 l 20 36 h -40 z" />
          <path d="M200 418 v 10 M200 434 v 1" />
        </g>
      );
    case "gas":
      return <path d="M204 404 l -14 22 h 12 l -6 18 l 16 -24 h -12 z" {...s} />;
    case "whale":
      return <path d="M176 424 q 12 -14 24 0 t 24 0 M176 438 q 12 -14 24 0 t 24 0" {...s} />;
    default:
      return <circle cx="200" cy="424" r="14" {...s} />;
  }
};

export const variantForSkill = (skill: string): PortraitVariant =>
  skill === "contract-audit" ? "auditor" : skill === "token-risk-score" ? "risk" : skill === "gas-timing" ? "gas" : /whale|liquidity/.test(skill) ? "whale" : "generic";
