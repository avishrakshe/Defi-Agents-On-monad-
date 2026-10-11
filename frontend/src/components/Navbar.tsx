"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { connectBrowserWallet, switchToMonadNetwork, MONAD_CHAIN_CONFIG } from "../lib/wallet";
import { scrollToId } from "../lib/smooth-scroll";
import { useBalances, ORCHESTRATOR_ADDRESS } from "../lib/useBalances";

interface NavbarProps {
  onOpenTaskModal?: () => void;
  onOpenRegisterModal?: () => void;
  /** Float the bar over the page content (used by the full-bleed homepage hero) */
  overlay?: boolean;
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

export const Navbar: React.FC<NavbarProps> = ({ onOpenTaskModal, onOpenRegisterModal, overlay = false }) => {
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
  const [scrolled, setScrolled] = useState(false);
  const orchestratorBalances = useBalances(ORCHESTRATOR_ADDRESS);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orchestratorAddress = `${ORCHESTRATOR_ADDRESS.slice(0, 6)}...${ORCHESTRATOR_ADDRESS.slice(-4)}`;

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

  // On the homepage, in-page anchors glide via Lenis instead of jumping
  const handleAnchorClick = (e: React.MouseEvent, href: string) => {
    if (pathname === "/" && href.startsWith("/#") && scrollToId(href.slice(2))) {
      e.preventDefault();
    }
  };

  // Condense the bar once the page has been scrolled
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`${
        overlay ? "fixed left-0 right-0 top-4" : "sticky top-4"
      } z-50 w-full px-4 sm:px-8 max-w-7xl mx-auto`}
    >
      {/* Dark glass pill bar */}
      <div
        onMouseLeave={handleMouseLeaveNav}
        className={`relative rounded-full border px-3 sm:px-5 py-2 flex items-center justify-between gap-4 transition-all duration-300 backdrop-blur-xl ${
          scrolled || !overlay
            ? "bg-[#0e0e0f]/90 border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)]"
            : "bg-white/[0.04] border-white/10"
        }`}
      >
        {/* Left: Brand & Nav Links */}
        <div className="flex items-center space-x-4 xl:space-x-6 shrink-0 min-w-0">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 clip-chamfer bg-[#ccff00] flex items-center justify-center font-display text-black text-sm group-hover:rotate-[-8deg] transition-transform">
              D
            </div>
            <span className="font-display text-base text-white tracking-wide">
              DeFi<span className="text-[#ccff00]">/</span>Agents
            </span>
          </Link>

          {/* Center: Pill Dropdown Track */}
          <nav className="hidden lg:flex items-center relative p-1 bg-white/[0.04] border border-white/10 rounded-full shrink-0">
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
                    className={`relative z-10 px-2.5 xl:px-3.5 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-wider whitespace-nowrap transition-colors duration-150 flex items-center gap-1 ${
                      isTabOpen || isRouteActive ? "text-[#ccff00]" : "text-white/65 hover:text-white"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.hasDropdown && (
                      <span
                        className={`text-[7px] transition-transform duration-200 inline-block ${
                          isTabOpen ? "rotate-180 text-[#ccff00]" : "text-white/35"
                        }`}
                      >
                        ▼
                      </span>
                    )}
                  </Link>

                  {/* Sliding hover pill highlight */}
                  {isTabHovered && (
                    <motion.div
                      layoutId="pillHighlight"
                      className="absolute inset-0 bg-white/[0.08] rounded-full z-0 border border-white/10"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                    />
                  )}

                  {/* Floating dropdown panel anchored beneath this tab */}
                  <AnimatePresence>
                    {isTabOpen && tab.hasDropdown && tab.subItems && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.97, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)" }}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.25 }}
                        onMouseEnter={() => {
                          if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }}
                        className={`absolute top-full mt-3 w-80 sm:w-96 bg-[#0e0e0f]/95 backdrop-blur-xl border border-white/10 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.8)] rounded-2xl p-2.5 z-[100] ${dropdownAlignClass}`}
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
                              onClick={(e) => {
                                handleAnchorClick(e, item.href);
                                setActiveTab(null);
                                if (item.onClick) item.onClick();
                              }}
                              className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.05] transition-colors"
                            >
                              <span className="w-8 h-8 clip-chamfer bg-white/[0.06] flex items-center justify-center text-sm shrink-0 group-hover:bg-[#ccff00] transition-colors">
                                {item.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-white leading-none">
                                    {item.title}
                                  </span>
                                  {item.badge && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#ccff00] text-black font-bold">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-white/45 mt-1 line-clamp-1 group-hover:text-white/70">
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
        <div className="flex items-center gap-2.5 xl:gap-4 shrink-0">
          {/* Network Pill */}
          {isWrongNetwork ? (
            <button
              onClick={handleSwitchNetwork}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/40 text-amber-300 font-mono text-[11px] uppercase hover:bg-amber-400/20 transition-all shrink-0 whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span>Switch to Monad</span>
            </button>
          ) : (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ccff00]/[0.08] border border-[#ccff00]/25 text-[#ccff00] font-mono text-[11px] uppercase shrink-0 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse"></span>
              <span>Monad 10143</span>
            </div>
          )}

          {/* Orchestrator Wallet Status (Spacious Screens) */}
          <div className="hidden min-[1720px]:flex flex-col text-right border-l border-white/10 pl-3 font-mono text-[11px] shrink-0">
            <div className="text-white/40 flex items-center justify-end gap-1">
              <span>Orchestrator</span>
              <span className="text-white/70">{orchestratorAddress}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-white/80" title={orchestratorBalances ? `${orchestratorBalances.mon} MON for gas` : undefined}>
                {orchestratorBalances ? `${orchestratorBalances.usdc} USDC` : "— USDC"}
              </span>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noreferrer"
                className="text-[#ccff00] hover:underline"
              >
                Top up faucet
              </a>
            </div>
          </div>

          {/* Connection Status Indicator (Spacious Screens) */}
          <div className="hidden min-[1720px]:flex flex-col text-right font-mono text-[11px] shrink-0">
            {address ? (
              <>
                <span className="text-[#ccff00] flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00]"></span>
                  <span>Connected</span>
                </span>
                <span className="text-white/50">{formattedAddress}</span>
              </>
            ) : (
              <>
                <span className="text-white/60">Not connected</span>
                <span className="text-white/35">Connect for Mode B</span>
              </>
            )}
          </div>

          {/* Connect Wallet Button */}
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn-neon btn-sm !text-[11px] !px-4 sm:!px-5 disabled:opacity-50 shrink-0 whitespace-nowrap"
          >
            <span>{connecting ? "Connecting..." : address ? formattedAddress : "Connect Wallet"}</span>
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/10 border border-white/10 flex flex-col items-center justify-center space-y-1.5 transition-colors p-2"
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

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
            data-lenis-prevent
            className="lg:hidden mt-2 bg-[#0e0e0f]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-3 shadow-2xl overflow-y-auto max-h-[75vh] z-[100]"
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
                      className="block p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-white font-mono uppercase tracking-wider text-sm hover:bg-white/[0.08]"
                    >
                      {tab.label}
                    </Link>
                  );
                }

                return (
                  <div key={tab.id} className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setMobileActiveAccordion(isAccordionOpen ? null : tab.id)}
                      className="w-full p-3 text-left font-mono uppercase tracking-wider text-sm text-white flex items-center justify-between"
                    >
                      <span>{tab.label}</span>
                      <span className={`text-xs transition-transform ${isAccordionOpen ? "rotate-180 text-[#ccff00]" : "text-white/40"}`}>
                        ▼
                      </span>
                    </button>

                    {isAccordionOpen && tab.subItems && (
                      <div className="px-2 pb-2 space-y-1 border-t border-white/10 pt-2">
                        {tab.subItems.map((item, idx) => (
                          <Link
                            key={idx}
                            href={item.href}
                            onClick={(e) => {
                              handleAnchorClick(e, item.href);
                              setMobileMenuOpen(false);
                            }}
                            className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.06] text-xs text-white/80"
                          >
                            <span>{item.icon}</span>
                            <span className="font-semibold text-white">{item.title}</span>
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
