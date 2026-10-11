import type { Metadata } from "next";
import { Instrument_Serif, Schibsted_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "../styles/globals.css";
import { Providers } from "./providers";
import { SmoothScroll } from "../components/SmoothScroll";

const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-mono", display: "swap" });

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
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased relative">
        <SmoothScroll />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
