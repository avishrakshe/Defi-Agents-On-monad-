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
        // "Riso Ledger" palette: warm paper, ink, and two risograph spot colours
        paper: { DEFAULT: "#F4EFE6", card: "#FBF8F2", shade: "#EAE2D3", deep: "#DED3BF" },
        ink: { DEFAULT: "#16130F", 2: "#4A453D", 3: "#8A8377" },
        violet: { DEFAULT: "#5B3DF5", soft: "#E4DEFF" },
        flame: { DEFAULT: "#FF5A1F", soft: "#FFE1D3" },
        moss: { DEFAULT: "#1E7A46", soft: "#D8EEDF" },
        sun: { DEFAULT: "#F2B705", soft: "#FCEFC2" },
        monad: {
          lime: "#ccff00",
          purple: "#836ef9"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "Menlo", "monospace"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      boxShadow: {
        hard: "4px 4px 0 0 #16130F",
        "hard-sm": "2px 2px 0 0 #16130F",
        "hard-violet": "5px 5px 0 0 #5B3DF5",
        "hard-flame": "5px 5px 0 0 #FF5A1F"
      },
      borderRadius: {
        sheet: "0px"
      },
      keyframes: {
        marquee: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        "spin-slow": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        scan: { "0%": { transform: "translateY(-100%)" }, "100%": { transform: "translateY(100%)" } },
        fadeIn: { "0%": { opacity: "0", transform: "translateY(4px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        blink: { "0%,49%": { opacity: "1" }, "50%,100%": { opacity: "0" } },
        stamp: { "0%": { transform: "scale(1.6) rotate(-14deg)", opacity: "0" }, "100%": { transform: "scale(1) rotate(-8deg)", opacity: "1" } }
      },
      animation: {
        marquee: "marquee 38s linear infinite",
        "spin-slow": "spin-slow 40s linear infinite",
        float: "float 6s ease-in-out infinite",
        scan: "scan 3s linear infinite",
        fadeIn: "fadeIn 0.35s ease-out both",
        blink: "blink 1s steps(1) infinite",
        stamp: "stamp 0.5s cubic-bezier(0.22,1,0.36,1) both"
      }
    },
  },
  plugins: [],
};
