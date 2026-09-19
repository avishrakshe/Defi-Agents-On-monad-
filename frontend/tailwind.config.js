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
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"]
      },
      boxShadow: {
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03)",
        elevated: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
        navbar: "0 4px 20px -2px rgba(0, 0, 0, 0.04)"
      },
      borderRadius: {
        "3xl": "1.5rem",
        "4xl": "2rem"
      }
    },
  },
  plugins: [],
};
