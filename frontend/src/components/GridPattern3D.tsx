"use client";

import React, { CSSProperties } from "react";

interface GridPattern3DProps {
  cellSize?: number;
  perspective?: number;
  angle?: number;
  speed?: number;
  lineColor?: string;
  glowColor?: string;
  /** Colour the grid fades into at the top and bottom edges */
  fadeColor?: string;
  className?: string;
}

/**
 * GridPattern3D
 * A perspective-tilted, endlessly scrolling grid plane ("synthwave horizon").
 * Fills its nearest positioned parent; pass a className to adjust placement.
 */
export const GridPattern3D: React.FC<GridPattern3DProps> = ({
  cellSize = 48,
  perspective = 500,
  angle = 68,
  speed = 2.4,
  lineColor = "rgba(204, 255, 0, 0.16)",
  glowColor = "rgba(204, 255, 0, 0.22)",
  fadeColor = "#151516",
  className = ""
}) => {
  const dynamicStyles = {
    "--grid-cell-size": `${cellSize}px`,
    "--grid-speed": `${speed}s`
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
      style={dynamicStyles}
    >
      {/* Horizon glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-[38%] w-[110%] h-[260px]"
        style={{
          background: `radial-gradient(ellipse 50% 50% at 50% 100%, ${glowColor} 0%, transparent 70%)`,
          filter: "blur(10px)"
        }}
      />

      {/* 3D perspective viewport — a floor plane receding from the bottom edge toward the horizon */}
      <div
        className="absolute inset-x-0 bottom-0 h-[60%]"
        style={{ perspective: `${perspective}px`, perspectiveOrigin: "50% 0%" }}
      >
        <div
          className="absolute bottom-0 left-[-70%] w-[240%] h-[200%]"
          style={{ transform: `rotateX(${angle}deg)`, transformOrigin: "50% 100%" }}
        >
          <div
            className="w-full h-full grid-pattern-3d-anim"
            style={{
              backgroundImage: `
                linear-gradient(to right, ${lineColor} 1px, transparent 1px),
                linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)
              `,
              backgroundSize: `${cellSize}px ${cellSize}px`,
              maskImage: "linear-gradient(to top, #000 0%, #000 40%, transparent 95%)",
              WebkitMaskImage: "linear-gradient(to top, #000 0%, #000 40%, transparent 95%)"
            }}
          />
        </div>
      </div>

      {/* Edge blending into the sheet colour */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${fadeColor} 35%, transparent 60%, transparent 85%, ${fadeColor} 100%)` }}
      />
    </div>
  );
};
