/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monad: {
          lime: "#ccff00",
          "lime-hover": "#b8e600",
          "lime-light": "#e8ff80",
          purple: "#836ef9",
          dark: "#0a0a0a",
          card: "#ffffff",
          muted: "#64748b",
          border: "#e2e8f0"
        },
        // Dark "Agent OS" surface tokens used by the homepage sheets
        void: {
          DEFAULT: "#0c0c0d",
          sheet: "#151516",
          raised: "#1c1c1e",
          line: "rgba(255,255,255,0.08)"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Menlo", "monospace"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"]
      },
      boxShadow: {
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)",
        elevated: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
        navbar: "0 4px 20px -2px rgba(0, 0, 0, 0.04)",
        glow: "0 0 0 1px rgba(204,255,0,0.35), 0 0 40px -6px rgba(204,255,0,0.45)"
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem",
        sheet: "2.75rem"
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        },
        cube: {
          "0%": { transform: "rotateX(-24deg) rotateY(0deg)" },
          "100%": { transform: "rotateX(-24deg) rotateY(360deg)" }
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" }
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        marquee: "marquee 32s linear infinite",
        "spin-slow": "spin-slow 40s linear infinite",
        cube: "cube 14s linear infinite",
        float: "float 6s ease-in-out infinite",
        scan: "scan 4s linear infinite",
        fadeIn: "fadeIn 0.35s ease-out both"
      }
    },
  },
  plugins: [],
};
