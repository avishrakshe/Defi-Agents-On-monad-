"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { connectBrowserWallet, switchToMonadNetwork, MONAD_CHAIN_CONFIG } from "../lib/wallet";

interface NavbarProps {
  onOpenTaskModal?: () => void;
  onOpenRegisterModal?: () => void;
}

interface NavSubItem {
  title: string;
  desc: string;
  href: string;
  icon: string;
  badge?: string;
  onClick?: () => void;
}

interface NavTab {
  id: string;
  label: string;
  href: string;
  hasDropdown: boolean;
  subItems?: NavSubItem[];
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenTaskModal, onOpenRegisterModal }) => {
  const pathname = usePathname();
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Active hovered dropdown tab
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [hoveredPill, setHoveredPill] = useState<string | null>(null);

  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActiveAccordion, setMobileActiveAccordion] = useState<string | null>(null);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orchestratorAddress = "0x39D1...C39B";

  useEffect(() => {
    // Check if wallet is already connected
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      ethereum
        .request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0]);
          }
        })
        .catch(() => {});

      ethereum
        .request({ method: "eth_chainId" })
        .then((hex: string) => {
          if (hex) setChainId(parseInt(hex, 16));
        })
        .catch(() => {});

      const handleAccountsChanged = (accs: string[]) => {
        setAddress(accs.length > 0 ? accs[0] : null);
      };
      const handleChainChanged = (hex: string) => {
        setChainId(parseInt(hex, 16));
      };

      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);

      return () => {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  const handleConnect = async () => {
    if (address) {
      setAddress(null);
      return;
    }

    try {
      setConnecting(true);
      const res = await connectBrowserWallet();
      setAddress(res.address);
      setChainId(res.chainId);
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
    } finally {
      setConnecting(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchToMonadNetwork();
      setChainId(MONAD_CHAIN_CONFIG.chainIdDecimal);
    } catch (err: any) {
      console.error("Network switch failed:", err);
    }
  };

  const formattedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
  const isWrongNetwork = address && chainId !== MONAD_CHAIN_CONFIG.chainIdDecimal;

  // Nav tabs structured after Framer Pill Dropdown Nav spec
  const NAV_TABS: NavTab[] = [
    {
      id: "marketplace",
      label: "Marketplace",
      href: "/",
      hasDropdown: true,
      subItems: [
        {
          title: "Specialist Agents Registry",
          desc: "Discover onchain verified auditor, risk, & timing agents",
          href: "/#registry",
          icon: "🤖"
        },
        {
          title: "Deterministic Task Console",
          desc: "Multi-agent autonomous decomposition & x402 calls",
          href: "/#task-console",
          icon: "⚡"
        },
        {
          title: "Register Custom Agent",
          desc: "Deploy your agent identity on Monad IdentityRegistry",
          href: "/#registry",
          icon: "➕",
          badge: "ERC-8004"
        }
      ]
    },
    {
      id: "academy",
      label: "Academy",
      href: "/learn",
      hasDropdown: true,
      subItems: [
        {
          title: "Academy Curriculum",
          desc: "Interactive documentation & contextual quiz engine",
          href: "/learn",
          icon: "🎓"
        },
        {
          title: "Monad Fundamentals",
          desc: "10,000 TPS parallel execution & MonadDB storage",
          href: "/learn/monad-fundamentals",
          icon: "⚡"
        },
        {
          title: "Tokenized Assets on Monad",
          desc: "Institutional RWAs, compliant vaults, & yield models",
          href: "/learn/tokenized-assets",
          icon: "🏛️"
        },
        {
          title: "x402 Micropayments Protocol",
          desc: "Sub-cent HTTP 402 gasless payment rails for AI agents",
          href: "/learn/x402",
          icon: "💳"
        }
      ]
    },
    {
      id: "dashboard",
      label: "Dashboard",
      href: "/dashboard",
      hasDropdown: true,
      subItems: [
        {
          title: "Learner Dashboard",
          desc: "Track cross-path progress, total XP, & day streaks",
          href: "/dashboard",
          icon: "📊"
        },
        {
          title: "Monad Scholar Certificate",
          desc: "Official Soulbound NFT credential & certificate download",
          href: "/dashboard/certificate",
          icon: "📜",
          badge: "Soulbound"
        }
      ]
    },
    {
      id: "activity",
      label: "Activity",
      href: "/activity",
      hasDropdown: true,
      subItems: [
        {
          title: "Transaction Explorer",
          desc: "Audit log of every micropayment, feedback, & mint",
          href: "/activity",
          icon: "🔍"
        },
        {
          title: "MonadVision Block Explorer",
          desc: "Inspect live Monad Testnet blocks & bytecode",
          href: "https://testnet.monadvision.com",
          icon: "↗"
        }
      ]
    },
    {
      id: "about",
      label: "About",
      href: "/about",
      hasDropdown: false
    }
  ];

  const handleMouseEnterTab = (tabId: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredPill(tabId);
    const tab = NAV_TABS.find((t) => t.id === tabId);
    if (tab && tab.hasDropdown) {
      setActiveTab(tabId);
    } else {
      setActiveTab(null);
    }
  };

  const handleMouseLeaveNav = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveTab(null);
      setHoveredPill(null);
    }, 180);
  };

  const currentTab = NAV_TABS.find((t) => t.id === activeTab);

  return (
    <header className="sticky top-4 z-50 w-full px-4 sm:px-8 max-w-7xl mx-auto">
      {/* Light Pill Bar Container (Previous Marketplace Style - 100% Solid Opaque) */}
      <div
        onMouseLeave={handleMouseLeaveNav}
        style={{ backgroundColor: "#ffffff" }}
        className="relative bg-white border border-gray-200/90 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 transition-all"
      >
        {/* Left: Brand & Nav Links */}
        <div className="flex items-center space-x-4 xl:space-x-7 shrink-0 min-w-0">
          <Link href="/" className="flex items-center space-x-2.5 group shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#ccff00] flex items-center justify-center font-black text-black text-base shadow-sm group-hover:scale-105 transition-transform">
              D
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">DeFi Agents</span>
          </Link>

          {/* Center: Framer Pill Dropdown Track (Light Theme Matching Marketplace) */}
          <nav className="hidden lg:flex items-center relative py-1 px-1 bg-[#f1f3f5] border border-gray-200/80 rounded-full shrink-0">
            {NAV_TABS.map((tab) => {
              const isTabHovered = hoveredPill === tab.id;
              const isTabOpen = activeTab === tab.id;
              const isRouteActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));

              // Anchor position based on which tab is active so dropdown appears directly below it
              const dropdownAlignClass =
                tab.id === "marketplace"
                  ? "left-0"
                  : tab.id === "academy"
                  ? "-left-12 sm:-left-8"
                  : tab.id === "dashboard"
                  ? "-left-24 sm:-left-20"
                  : tab.id === "activity"
                  ? "right-0"
                  : "left-1/2 -translate-x-1/2";

              return (
                <div
                  key={tab.id}
                  onMouseEnter={() => handleMouseEnterTab(tab.id)}
                  className="relative"
                >
                  <Link
                    href={tab.href}
                    className={`relative z-10 px-2.5 xl:px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors duration-150 flex items-center space-x-1 ${
                      isTabOpen || isRouteActive
                        ? "text-gray-950 font-bold"
                        : "text-gray-600 hover:text-gray-950"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.hasDropdown && (
                      <span
                        className={`text-[8px] transition-transform duration-200 inline-block text-gray-400 ${
                          isTabOpen ? "rotate-180 text-gray-950" : ""
                        }`}
                      >
                        ▼
                      </span>
                    )}
                  </Link>

                  {/* Sliding Hover Pill Highlight (Framer pill highlight on light track) */}
                  {isTabHovered && (
                    <motion.div
                      layoutId="pillHighlight"
                      className="absolute inset-0 bg-white rounded-full shadow-sm z-0 border border-gray-200/60"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                    />
                  )}

                  {/* Floating Dropdown Panel anchored directly beneath this tab */}
                  <AnimatePresence>
                    {isTabOpen && tab.hasDropdown && tab.subItems && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.2 }}
                        onMouseEnter={() => {
                          if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }}
                        style={{ backgroundColor: "#ffffff" }}
                        className={`absolute top-full mt-3 w-80 sm:w-96 bg-white border border-gray-200 shadow-[0_20px_50px_rgba(0,0,0,0.18)] rounded-2xl p-3 z-[100] ${dropdownAlignClass}`}
                      >
                        {/* Invisible hover bridge to prevent cursor gap drop */}
                        <div className="absolute -top-3 left-0 right-0 h-3" />

                        <div className="space-y-1">
                          {tab.subItems.map((item, idx) => (
                            <Link
                              key={idx}
                              href={item.href}
                              target={item.href.startsWith("http") ? "_blank" : undefined}
                              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                              onClick={() => {
                                setActiveTab(null);
                                if (item.onClick) item.onClick();
                              }}
                              className="group flex items-start space-x-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                              <span className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200/80 flex items-center justify-center text-sm shrink-0 group-hover:bg-[#ccff00] group-hover:border-[#b8e600] transition-colors shadow-2xs">
                                {item.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  {/* Crisp Dark Text - 100% High Contrast */}
                                  <span className="text-xs font-bold text-gray-950 group-hover:text-black transition-colors leading-none">
                                    {item.title}
                                  </span>
                                  {item.badge && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#ccff00] text-black border border-[#b8e600] font-bold">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-gray-500 mt-1 line-clamp-1 group-hover:text-gray-700">
                                  {item.desc}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right: Network Status, Orchestrator Info, Connect Button */}
        <div className="flex items-center space-x-2.5 xl:space-x-4 shrink-0">
          {/* Network Pill */}
          {isWrongNetwork ? (
            <button
              onClick={handleSwitchNetwork}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-all shrink-0 whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Switch to Monad</span>
            </button>
          ) : (
            <div className="hidden xl:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-medium shrink-0 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Monad 10143</span>
            </div>
          )}

          {/* Orchestrator Wallet Status (Spacious Screens) */}
          <div className="hidden 2xl:flex flex-col text-right border-l border-gray-200 pl-3 text-xs shrink-0">
            <div className="text-gray-400 flex items-center justify-end space-x-1">
              <span>Orchestrator</span>
              <span className="font-mono text-gray-600 font-semibold">{orchestratorAddress}</span>
            </div>
            <div className="flex items-center justify-end space-x-1.5">
              <span className="text-gray-700 font-semibold">100.00 tUSDC</span>
              <a
                href="https://faucet.monad.xyz"
                target="_blank"
                rel="noreferrer"
                className="text-[#65a30d] hover:underline font-medium"
              >
                Top up faucet
              </a>
            </div>
          </div>

          {/* Connection Status Indicator (Spacious Screens) */}
          <div className="hidden 2xl:flex flex-col text-right text-xs shrink-0">
            {address ? (
              <>
                <span className="text-emerald-600 font-medium flex items-center justify-end space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Connected</span>
                </span>
                <span className="font-mono text-gray-500">{formattedAddress}</span>
              </>
            ) : (
              <>
                <span className="text-gray-500 font-medium">Not connected</span>
                <span className="text-gray-400">Connect for Mode B</span>
              </>
            )}
          </div>

          {/* Connect Wallet Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn-monad-lime text-xs sm:text-sm font-bold shadow-sm disabled:opacity-50 shrink-0 whitespace-nowrap py-2 px-3.5 sm:px-5"
          >
            {connecting
              ? "Connecting..."
              : address
              ? formattedAddress
              : "Connect Wallet"}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 flex flex-col items-center justify-center space-y-1.5 transition-colors p-2"
            aria-label="Toggle navigation menu"
          >
            <motion.span
              animate={mobileMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
              className="w-4 h-0.5 bg-gray-800 rounded-full block transition-transform"
            />
            <motion.span
              animate={mobileMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
              className="w-4 h-0.5 bg-gray-800 rounded-full block transition-transform"
            />
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Light Theme Accordion - 100% Solid Opaque) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ backgroundColor: "#ffffff" }}
            className="lg:hidden mt-2 bg-white border border-gray-200 rounded-3xl p-4 shadow-2xl overflow-hidden z-[100]"
          >
            <div className="space-y-2">
              {NAV_TABS.map((tab) => {
                const isAccordionOpen = mobileActiveAccordion === tab.id;

                if (!tab.hasDropdown) {
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block p-3 rounded-2xl bg-gray-50 border border-gray-200/70 text-gray-900 font-bold text-sm hover:bg-gray-100"
                    >
                      {tab.label}
                    </Link>
                  );
                }

                return (
                  <div key={tab.id} className="rounded-2xl bg-gray-50 border border-gray-200/70 overflow-hidden">
                    <button
                      onClick={() => setMobileActiveAccordion(isAccordionOpen ? null : tab.id)}
                      className="w-full p-3 text-left font-bold text-sm text-gray-900 flex items-center justify-between"
                    >
                      <span>{tab.label}</span>
                      <span className={`text-xs text-gray-400 transition-transform ${isAccordionOpen ? "rotate-180 text-black" : ""}`}>
                        ▼
                      </span>
                    </button>

                    {isAccordionOpen && tab.subItems && (
                      <div className="px-3 pb-3 space-y-1.5 border-t border-gray-200/60 pt-2 bg-white">
                        {tab.subItems.map((item, idx) => (
                          <Link
                            key={idx}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-gray-50 text-xs text-gray-700 hover:text-black font-medium"
                          >
                            <span>{item.icon}</span>
                            <span className="font-bold text-gray-900">{item.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
