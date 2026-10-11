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

const PALETTE: Record<PortraitVariant, { eye: string; accent: string; plate: string }> = {
  auditor: { eye: "#ccff00", accent: "#ccff00", plate: "#1d2410" },
  risk: { eye: "#ff3b6b", accent: "#ff6b8b", plate: "#2a1218" },
  gas: { eye: "#ffb020", accent: "#ffcc4d", plate: "#2a2010" },
  whale: { eye: "#4dd8ff", accent: "#8be9ff", plate: "#0f2230" },
  generic: { eye: "#a594ff", accent: "#c4b8ff", plate: "#1b1630" }
};

/**
 * Vector-rendered agent bust. Pure SVG, so it stays razor sharp at any resolution (4K and beyond)
 * and ships at a few KB. Each specialist has its own head gear, visor and emblem.
 */
export const AgentPortrait: React.FC<AgentPortraitProps> = ({ variant, crop = "full", className = "", animated = true }) => {
  const { eye, accent, plate } = PALETTE[variant];
  const id = `ap-${variant}-${useId().replace(/:/g, "")}`;
  const viewBox = crop === "head" ? "62 58 276 276" : "0 0 400 480";
  const isWhale = variant === "whale";
  const head = isWhale ? { x: 92, y: 78, w: 216, h: 236, rx: 104 } : { x: 96, y: 92, w: 208, h: 220, rx: 72 };

  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={`${variant} agent portrait`} preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b5b68" />
          <stop offset="35%" stopColor="#2c2c34" />
          <stop offset="100%" stopColor="#0b0b0e" />
        </linearGradient>
        <linearGradient id={`${id}-metalSide`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="25%" stopColor="#000" stopOpacity="0" />
          <stop offset="75%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1e28" />
          <stop offset="100%" stopColor="#030304" />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-eye`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="35%" stopColor={eye} />
          <stop offset="100%" stopColor={eye} stopOpacity="0.2" />
        </radialGradient>
        <radialGradient id={`${id}-aura`} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor={eye} stopOpacity="0.35" />
          <stop offset="100%" stopColor={eye} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <clipPath id={`${id}-visorClip`}>
          <rect x="120" y="166" width="160" height="76" rx="36" />
        </clipPath>
      </defs>

      {/* Aura */}
      <ellipse cx="200" cy="230" rx="190" ry="210" fill={`url(#${id}-aura)`} />

      <g filter={`url(#${id}-shadow)`}>
        {/* ---------- Torso ---------- */}
        <path d="M30 480 C 34 404, 92 362, 150 354 L 250 354 C 308 362, 366 404, 370 480 Z" fill={`url(#${id}-metal)`} />
        <path d="M30 480 C 34 404, 92 362, 150 354 L 250 354 C 308 362, 366 404, 370 480 Z" fill={`url(#${id}-metalSide)`} />
        {/* Shoulder pads */}
        <path d="M44 440 C 52 400, 84 378, 128 370 L 136 404 C 100 410, 76 426, 64 452 Z" fill="#3a3a44" />
        <path d="M356 440 C 348 400, 316 378, 272 370 L 264 404 C 300 410, 324 426, 336 452 Z" fill="#3a3a44" />
        <path d="M58 432 L 120 392" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        <path d="M342 432 L 280 392" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        {variant === "risk" && (
          <g opacity="0.85">
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M${70 + i * 14} 452 l 10 -18`} stroke="#ffcc4d" strokeWidth="5" />
            ))}
          </g>
        )}
        {/* Chest plate */}
        <path d="M140 384 L 260 384 L 248 462 L 152 462 Z" fill={plate} stroke={accent} strokeOpacity="0.6" strokeWidth="2" />
        <path d="M150 392 L 250 392" stroke="#fff" strokeOpacity="0.12" strokeWidth="2" />
        <Emblem variant={variant} accent={accent} />

        {/* ---------- Neck ---------- */}
        <rect x="168" y="296" width="64" height="66" rx="10" fill="#1a1a20" />
        {[312, 328, 344].map((y) => (
          <rect key={y} x="162" y={y} width="76" height="8" rx="4" fill="#3d3d48" />
        ))}

        {/* ---------- Ear modules ---------- */}
        {[head.x - 4, head.x + head.w + 4].map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy="212" r="34" fill={`url(#${id}-metal)`} stroke="#0b0b0e" strokeWidth="3" />
            <circle cx={cx} cy="212" r="20" fill="#0b0b0e" />
            <circle cx={cx} cy="212" r="13" fill="none" stroke={eye} strokeWidth="3" filter={`url(#${id}-glow)`}>
              {animated && <animate attributeName="stroke-opacity" values="1;0.35;1" dur="2.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />}
            </circle>
          </g>
        ))}

        {/* ---------- Head ---------- */}
        <rect x={head.x} y={head.y} width={head.w} height={head.h} rx={head.rx} fill={`url(#${id}-metal)`} />
        <rect x={head.x} y={head.y} width={head.w} height={head.h} rx={head.rx} fill={`url(#${id}-metalSide)`} />
        <ellipse cx="172" cy={head.y + 30} rx="62" ry="16" fill="#fff" opacity="0.13" />
        {/* Panel seams */}
        <path d={`M200 ${head.y + 4} L 200 160`} stroke="#000" strokeOpacity="0.45" strokeWidth="2" />
        <path d={`M${head.x + 22} 262 Q 200 ${isWhale ? 300 : 290} ${head.x + head.w - 22} 262`} stroke="#000" strokeOpacity="0.35" strokeWidth="2" fill="none" />

        <HeadGear variant={variant} accent={accent} eye={eye} head={head} glow={`url(#${id}-glow)`} animated={animated} />

        {/* ---------- Visor ---------- */}
        <rect x="116" y="162" width="168" height="84" rx="40" fill="#0b0b0e" />
        <rect x="120" y="166" width="160" height="76" rx="36" fill={`url(#${id}-visor)`} />
        <g clipPath={`url(#${id}-visorClip)`}>
          <Eyes variant={variant} id={id} eye={eye} animated={animated} />
          <path d="M120 166 L 230 166 L 160 242 L 120 242 Z" fill={`url(#${id}-gloss)`} opacity="0.5" />
        </g>
        <rect x="120" y="166" width="160" height="76" rx="36" fill="none" stroke={eye} strokeOpacity="0.35" strokeWidth="1.5" />

        {/* Mouth grille */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={172 + i * 12} y="268" width="6" height="16" rx="3" fill="#0b0b0e" opacity="0.8" />
        ))}
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */

const Eyes: React.FC<{ variant: PortraitVariant; id: string; eye: string; animated: boolean }> = ({ variant, id, eye, animated }) => {
  const blink = animated ? <animate attributeName="opacity" values="1;1;0.08;1" keyTimes="0;0.9;0.94;1" dur="4.5s" repeatCount="indefinite" /> : null;
  const glow = `url(#${id}-glow)`;

  switch (variant) {
    case "auditor":
      return (
        <g filter={glow}>
          <rect x="148" y="190" width="30" height="26" rx="7" fill={`url(#${id}-eye)`}>{blink}</rect>
          <rect x="222" y="190" width="30" height="26" rx="7" fill={`url(#${id}-eye)`}>{blink}</rect>
          {/* Monocle lens */}
          <circle cx="237" cy="203" r="25" fill="none" stroke={eye} strokeWidth="2.5" opacity="0.8" />
          {animated && (
            <rect x="120" y="166" width="160" height="3" fill={eye} opacity="0.5">
              <animateTransform attributeName="transform" type="translate" values="0 0; 0 74; 0 0" dur="3.2s" repeatCount="indefinite" />
            </rect>
          )}
        </g>
      );
    case "risk":
      return (
        <g filter={glow}>
          <circle cx="200" cy="204" r="30" fill="none" stroke={eye} strokeWidth="2" opacity="0.6" />
          <circle cx="200" cy="204" r="20" fill={`url(#${id}-eye)`}>{blink}</circle>
          <path d="M200 170 V 238 M 160 204 H 240" stroke={eye} strokeWidth="1.5" opacity="0.55" />
          {animated && (
            <rect x="120" y="166" width="6" height="76" fill={eye} opacity="0.55">
              <animateTransform attributeName="transform" type="translate" values="0 0; 154 0; 0 0" dur="2.6s" repeatCount="indefinite" />
            </rect>
          )}
        </g>
      );
    case "gas":
      return (
        <g filter={glow}>
          {Array.from({ length: 9 }).map((_, i) => (
            <rect key={i} x={146 + i * 12} y="196" width="9" height="16" rx="2" fill={eye} opacity={0.35 + (i % 3) * 0.25}>
              {animated && <animate attributeName="opacity" values="0.25;1;0.25" dur="1.6s" begin={`${i * 0.12}s`} repeatCount="indefinite" />}
            </rect>
          ))}
        </g>
      );
    case "whale":
      return (
        <g filter={glow}>
          <path d="M132 206 Q 150 186 168 206 T 204 206 T 240 206 T 272 206" fill="none" stroke={eye} strokeWidth="6" strokeLinecap="round">
            {animated && <animate attributeName="d" values="M132 206 Q 150 186 168 206 T 204 206 T 240 206 T 272 206;M132 206 Q 150 224 168 206 T 204 206 T 240 206 T 272 206;M132 206 Q 150 186 168 206 T 204 206 T 240 206 T 272 206" dur="3s" repeatCount="indefinite" />}
          </path>
          <circle cx="168" cy="222" r="4" fill={eye}>{blink}</circle>
          <circle cx="232" cy="222" r="4" fill={eye}>{blink}</circle>
        </g>
      );
    default:
      return (
        <g filter={glow}>
          <circle cx="166" cy="204" r="13" fill={`url(#${id}-eye)`}>{blink}</circle>
          <circle cx="234" cy="204" r="13" fill={`url(#${id}-eye)`}>{blink}</circle>
        </g>
      );
  }
};

const HeadGear: React.FC<{
  variant: PortraitVariant;
  accent: string;
  eye: string;
  head: { x: number; y: number; w: number; h: number };
  glow: string;
  animated: boolean;
}> = ({ variant, accent, eye, head, glow, animated }) => {
  switch (variant) {
    case "auditor":
      // Crest fin + shield badge on the forehead
      return (
        <g>
          <path d={`M184 ${head.y + 2} L 216 ${head.y + 2} L 210 ${head.y - 34} L 190 ${head.y - 34} Z`} fill="#3a3a44" />
          <path d={`M195 ${head.y - 32} L 205 ${head.y - 32} L 205 ${head.y} L 195 ${head.y} Z`} fill={accent} />
          <path d="M200 120 l 16 6 v 12 c 0 10 -8 16 -16 20 c -8 -4 -16 -10 -16 -20 v -12 z" fill="#0b0b0e" stroke={accent} strokeWidth="2.5" />
          <path d="M193 136 l 5 5 l 10 -10" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "risk":
      // Radar dish antenna with sweeping arc
      return (
        <g>
          <path d={`M262 ${head.y + 14} L 286 ${head.y - 22}`} stroke="#3a3a44" strokeWidth="7" strokeLinecap="round" />
          <path d={`M270 ${head.y - 42} Q 300 ${head.y - 50} 312 ${head.y - 20} Z`} fill="#3a3a44" stroke={accent} strokeWidth="2" />
          <circle cx="292" cy={head.y - 30} r="5" fill={eye} filter={glow}>
            {animated && <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />}
          </circle>
          <path d="M150 128 h 100" stroke={accent} strokeWidth="3" strokeDasharray="8 6" opacity="0.7" />
        </g>
      );
    case "gas":
      // Forehead gauge with live needle + nozzle antenna
      return (
        <g>
          <path d="M160 150 A 40 40 0 0 1 240 150" fill="#0b0b0e" stroke={accent} strokeWidth="3" />
          {[-60, -30, 0, 30, 60].map((a) => (
            <line key={a} x1="200" y1="114" x2="200" y2="120" stroke={accent} strokeWidth="2" transform={`rotate(${a} 200 150)`} />
          ))}
          <line x1="200" y1="150" x2="200" y2="122" stroke={eye} strokeWidth="3" strokeLinecap="round" filter={glow}>
            {animated && <animateTransform attributeName="transform" type="rotate" values="-50 200 150; 40 200 150; -10 200 150; -50 200 150" dur="4s" repeatCount="indefinite" />}
          </line>
          <circle cx="200" cy="150" r="4" fill={accent} />
          <path d={`M132 ${head.y + 20} L 118 ${head.y - 16} L 134 ${head.y - 22} L 146 ${head.y + 12} Z`} fill="#3a3a44" stroke={accent} strokeWidth="2" />
        </g>
      );
    case "whale":
      // Sonar pings rising from a dorsal fin
      return (
        <g>
          <path d={`M188 ${head.y + 6} Q 204 ${head.y - 40} 228 ${head.y - 46} Q 214 ${head.y - 18} 214 ${head.y + 6} Z`} fill="#3a3a44" stroke={accent} strokeWidth="2" />
          {animated &&
            [0, 1, 2].map((i) => (
              <circle key={i} cx="204" cy={head.y - 20} r="10" fill="none" stroke={eye} strokeWidth="2">
                <animate attributeName="r" values="8;54" dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.9;0" dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
              </circle>
            ))}
        </g>
      );
    default:
      return <line x1="200" y1={head.y} x2="200" y2={head.y - 28} stroke="#3a3a44" strokeWidth="6" strokeLinecap="round" />;
  }
};

const Emblem: React.FC<{ variant: PortraitVariant; accent: string }> = ({ variant, accent }) => {
  const common = { fill: "none", stroke: accent, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (variant) {
    case "auditor":
      return <path d="M200 402 l 18 7 v 14 c 0 12 -9 19 -18 23 c -9 -4 -18 -11 -18 -23 v -14 z" {...common} />;
    case "risk":
      return (
        <g {...common}>
          <circle cx="200" cy="422" r="18" />
          <path d="M200 410 v 14 M200 432 v 1" />
        </g>
      );
    case "gas":
      return <path d="M204 404 l -14 22 h 12 l -6 18 l 16 -24 h -12 z" {...common} />;
    case "whale":
      return <path d="M176 424 q 12 -14 24 0 t 24 0 M176 436 q 12 -14 24 0 t 24 0" {...common} />;
    default:
      return <circle cx="200" cy="422" r="14" {...common} />;
  }
};

export const variantForSkill = (skill: string): PortraitVariant =>
  skill === "contract-audit" ? "auditor" : skill === "token-risk-score" ? "risk" : skill === "gas-timing" ? "gas" : /whale|liquidity/.test(skill) ? "whale" : "generic";
