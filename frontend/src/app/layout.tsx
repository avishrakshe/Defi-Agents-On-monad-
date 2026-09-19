import type { Metadata } from "next";
import "../styles/globals.css";
import { Providers } from "./providers";
import { GridPattern3D } from "../components/GridPattern3D";

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
    <html lang="en">
      <body className="min-h-screen bg-[#f8f9fa] text-[#0f172a] antialiased relative">
        <GridPattern3D />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
