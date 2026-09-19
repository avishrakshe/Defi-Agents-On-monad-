"use client";

import React, { CSSProperties } from "react";

interface GridPattern3DProps {
  cellSize?: number;
  perspective?: number;
  angle?: number;
  speed?: number;
  lineColor?: string;
  glowColor?: string;
  className?: string;
}

/**
 * GridPattern3D
 * Faithfully reproduces the Framer 'Grid Pattern 3d' component by Kehinde Clement.
 * Features 3D perspective projection (65° tilt), continuous seamless vertical scrolling,
 * custom atmospheric horizon glow, and non-intrusive dual-layer fade mask.
 */
export const GridPattern3D: React.FC<GridPattern3DProps> = ({
  cellSize = 48,
  perspective = 340,
  angle = 65,
  speed = 3.5,
  lineColor = "rgba(15, 23, 42, 0.08)",
  glowColor = "rgba(204, 255, 0, 0.16)",
  className = ""
}) => {
  const dynamicStyles = {
    "--grid-cell-size": `${cellSize}px`,
    "--grid-speed": `${speed}s`
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none ${className}`}
      style={dynamicStyles}
    >
      {/* 3D Perspective Viewport */}
      <div
        className="absolute inset-0 w-full h-full flex justify-center"
        style={{
          perspective: `${perspective}px`,
          perspectiveOrigin: "50% 20%"
        }}
      >
        {/* Atmospheric Horizon Ambient Glow (Monad Electric Lime Accents) */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[360px] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 15%, ${glowColor} 0%, rgba(204, 255, 0, 0.03) 45%, transparent 75%)`,
            filter: "blur(24px)"
          }}
        />

        {/* Tilted 3D Grid Plane */}
        <div
          className="relative w-[180vw] h-[150vh] origin-top"
          style={{
            transform: `rotateX(${angle}deg)`,
            transformOrigin: "50% 0%"
          }}
        >
          {/* Animated Continuous Scrolling Grid Texture */}
          <div
            className="w-full h-full grid-pattern-3d-anim"
            style={{
              backgroundImage: `
                linear-gradient(to right, ${lineColor} 1px, transparent 1px),
                linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)
              `,
              backgroundSize: `${cellSize}px ${cellSize}px`,
              maskImage: `
                linear-gradient(to bottom, 
                  rgba(0, 0, 0, 0) 0%, 
                  rgba(0, 0, 0, 0.9) 15%, 
                  rgba(0, 0, 0, 0.95) 45%, 
                  rgba(0, 0, 0, 0) 80%
                )
              `,
              WebkitMaskImage: `
                linear-gradient(to bottom, 
                  rgba(0, 0, 0, 0) 0%, 
                  rgba(0, 0, 0, 0.9) 15%, 
                  rgba(0, 0, 0, 0.95) 45%, 
                  rgba(0, 0, 0, 0) 80%
                )
              `
            }}
          />
        </div>
      </div>

      {/* Atmospheric Horizon Blending */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f8f9fa]/80 via-transparent to-[#f8f9fa] pointer-events-none" />
    </div>
  );
};
