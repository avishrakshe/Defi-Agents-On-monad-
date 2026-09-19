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

  // Active hovered dropdown tab (null when closed)
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
    <header className="sticky top-4 z-50 w-full px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Framer-Inspired Floating Pill Bar Container */}
      <div
        onMouseLeave={handleMouseLeaveNav}
        className="relative bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-full shadow-[0px_18px_40px_-14px_rgba(0,0,0,0.5)] px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all"
      >
        {/* Left: Brand Logo */}
        <div className="flex items-center space-x-3 shrink-0">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-full bg-[#ccff00] flex items-center justify-center font-black text-black text-base shadow-sm group-hover:scale-105 transition-transform">
              D
            </div>
            <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              DeFi Agents
            </span>
          </Link>
        </div>

        {/* Center: Framer Pill Dropdown Track (Desktop) */}
        <nav className="hidden lg:flex items-center relative py-1 px-1.5 bg-white/5 border border-white/10 rounded-full">
          {NAV_TABS.map((tab) => {
            const isTabHovered = hoveredPill === tab.id;
            const isTabOpen = activeTab === tab.id;
            const isRouteActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));

            return (
              <div
                key={tab.id}
                onMouseEnter={() => handleMouseEnterTab(tab.id)}
                className="relative"
              >
                <Link
                  href={tab.href}
                  className={`relative z-10 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors duration-150 flex items-center space-x-1 ${
                    isTabOpen || isRouteActive
                      ? "text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.hasDropdown && (
                    <span
                      className={`text-[9px] transition-transform duration-200 inline-block text-gray-400 ${
                        isTabOpen ? "rotate-180 text-[#ccff00]" : ""
                      }`}
                    >
                      ▼
                    </span>
                  )}
                </Link>

                {/* Sliding Hover Pill Indicator (matching Framer framer-1sbno98) */}
                {isTabHovered && (
                  <motion.div
                    layoutId="pillHighlight"
                    className="absolute inset-0 bg-white/10 rounded-full z-0 border border-white/10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                  />
                )}
              </div>
            );
          })}

          {/* Floating Dropdown Panel / Surface (Framer framer-s0tgcb) */}
          <AnimatePresence>
            {activeTab && currentTab && currentTab.hasDropdown && currentTab.subItems && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ type: "spring", bounce: 0.1, duration: 0.25 }}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 sm:w-96 bg-[#0b0f19]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0px_24px_48px_-18px_rgba(0,0,0,0.7)] p-3 z-50"
              >
                <div className="space-y-1">
                  {currentTab.subItems.map((item, idx) => (
                    <Link
                      key={idx}
                      href={item.href}
                      onClick={() => {
                        setActiveTab(null);
                        if (item.onClick) item.onClick();
                      }}
                      className="group flex items-start space-x-3 p-2.5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-sm shrink-0 group-hover:bg-[#ccff00]/20 group-hover:border-[#ccff00]/40 transition-colors">
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white group-hover:text-[#ccff00] transition-colors leading-none">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-[#ccff00]/20 text-[#ccff00] border border-[#ccff00]/40 font-semibold">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1 group-hover:text-gray-300">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Right: Network Status, Orchestrator Status, Connect Wallet Button */}
        <div className="flex items-center space-x-3">
          {/* Network Pill */}
          {isWrongNetwork ? (
            <button
              onClick={handleSwitchNetwork}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>Switch Network</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Monad 10143</span>
            </div>
          )}

          {/* Orchestrator Status (Desktop) */}
          <div className="hidden xl:flex items-center space-x-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
            <span className="text-gray-400">Orchestrator:</span>
            <span className="font-mono text-white font-semibold">{orchestratorAddress}</span>
            <span className="text-[#ccff00] font-bold">100 tUSDC</span>
          </div>

          {/* Connect Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn-monad-lime text-xs font-bold py-2 px-4 shadow-sm hover:shadow-md transition-all shrink-0"
          >
            {connecting
              ? "Connecting..."
              : address
              ? formattedAddress
              : "Connect Wallet"}
          </button>

          {/* Mobile Hamburger Button (Framer Phone Menu Toggle) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex flex-col items-center justify-center space-y-1.5 transition-colors p-2"
            aria-label="Toggle navigation menu"
          >
            <motion.span
              animate={mobileMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
              className="w-4 h-0.5 bg-white rounded-full block transition-transform"
            />
            <motion.span
              animate={mobileMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
              className="w-4 h-0.5 bg-white rounded-full block transition-transform"
            />
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Accordion Style from Framer Phone Open Variant) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden mt-2 bg-[#0b0f19]/98 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 shadow-2xl overflow-hidden"
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
                      className="block p-3 rounded-2xl bg-white/5 border border-white/5 text-white font-bold text-sm hover:bg-white/10"
                    >
                      {tab.label}
                    </Link>
                  );
                }

                return (
                  <div key={tab.id} className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
                    <button
                      onClick={() => setMobileActiveAccordion(isAccordionOpen ? null : tab.id)}
                      className="w-full p-3 text-left font-bold text-sm text-white flex items-center justify-between"
                    >
                      <span>{tab.label}</span>
                      <span className={`text-xs text-gray-400 transition-transform ${isAccordionOpen ? "rotate-180 text-[#ccff00]" : ""}`}>
                        ▼
                      </span>
                    </button>

                    {isAccordionOpen && tab.subItems && (
                      <div className="px-3 pb-3 space-y-1.5 border-t border-white/5 pt-2">
                        {tab.subItems.map((item, idx) => (
                          <Link
                            key={idx}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center space-x-2.5 p-2 rounded-xl hover:bg-white/10 text-xs text-gray-300 hover:text-white"
                          >
                            <span>{item.icon}</span>
                            <span className="font-semibold">{item.title}</span>
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
