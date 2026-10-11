import type { Metadata } from "next";
import { Audiowide, Kode_Mono, Space_Grotesk } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";
import { SmoothScroll } from "../components/SmoothScroll";

const display = Audiowide({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
// Next has no fallback metrics for Kode Mono, so skip the size-adjusted fallback
const mono = Kode_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", adjustFontFallback: false });
const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "DeFi Agent Marketplace | Monad Testnet",
  description: "Autonomous DeFi specialist agents discovery, verification, and x402 pay-per-call marketplace on Monad Testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-[#f8f9fa] text-[#0f172a] antialiased relative">
        <SmoothScroll />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
