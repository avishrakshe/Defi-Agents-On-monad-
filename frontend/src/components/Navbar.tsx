"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { connectBrowserWallet, switchToMonadNetwork, MONAD_CHAIN_CONFIG } from "../lib/wallet";
import { scrollToId } from "../lib/smooth-scroll";
import { useBalances, ORCHESTRATOR_ADDRESS } from "../lib/useBalances";
import { useNetwork } from "../lib/network";
import { getOrchestratorUrl } from "../lib/orchestrator";
import { NetworkSwitch } from "./NetworkSwitch";
import { SolanaWalletButton } from "./SolanaWalletButton";

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
  const { network } = useNetwork();
  const [mbStatus, setMbStatus] = useState<any>(null);
  useEffect(() => {
    if (network !== "magicblock") return;
    let alive = true;
    fetch(`${getOrchestratorUrl()}/api/status?chain=magicblock`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setMbStatus(s))
      .catch(() => alive && setMbStatus(null));
    return () => {
      alive = false;
    };
  }, [network]);

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

  const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

  return (
    <header className="sticky top-0 z-50 w-full bg-paper/95 backdrop-blur-[2px]">
      {/* Dateline strip */}
      <div
        className={`border-b border-ink/15 overflow-hidden transition-[max-height,opacity] duration-300 ${
          scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-8 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-2">
          <span className="hidden sm:inline">{today}</span>
          {network === "magicblock" ? (
            <>
              <span>MagicBlock edition · Solana devnet + Ephemeral Rollup</span>
              <span className="hidden md:inline">
                Operator {mbStatus?.operatorAddress ? `${mbStatus.operatorAddress.slice(0, 4)}…${mbStatus.operatorAddress.slice(-4)}` : "—"} · Tab{" "}
                {mbStatus?.tab ? `${mbStatus.tab.availableTUSDC} tUSDC` : "—"}
              </span>
            </>
          ) : (
            <>
              <span>Monad Testnet edition · Chain 10143</span>
              <span className="hidden md:inline">
                Operator {orchestratorAddress} · {orchestratorBalances ? `${orchestratorBalances.usdc} USDC / ${orchestratorBalances.mon} MON` : "— USDC"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Masthead bar */}
      <div onMouseLeave={handleMouseLeaveNav} className="relative border-b-[1.5px] border-ink">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <span className="relative w-9 h-9 bg-ink text-paper flex items-center justify-center font-display text-xl italic leading-none transition-transform group-hover:-rotate-6">
              d
              <span className="absolute -right-1 -bottom-1 w-3 h-3 bg-flame" />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[1.65rem] tracking-tight">DeFi Agents</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-ink-2 mt-0.5">
                {network === "magicblock" ? "Marketplace on MagicBlock" : "Marketplace on Monad"}
              </span>
            </span>
          </Link>

          {/* Section links */}
          <nav className="hidden lg:flex items-stretch h-full">
            {NAV_TABS.map((tab) => {
              const isTabOpen = activeTab === tab.id;
              const isRouteActive = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
              const dropdownAlignClass = tab.id === "activity" || tab.id === "about" ? "right-0" : "left-0";

              return (
                <div key={tab.id} onMouseEnter={() => handleMouseEnterTab(tab.id)} className="relative flex items-stretch">
                  <Link
                    href={tab.href}
                    className={`relative flex items-center gap-1.5 px-3.5 font-mono text-[12px] uppercase tracking-[0.12em] transition-colors ${
                      isTabOpen || isRouteActive ? "text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    {tab.label}
                    {tab.hasDropdown && <span className={`text-[9px] transition-transform ${isTabOpen ? "rotate-180" : ""}`}>▾</span>}
                    {(isRouteActive || isTabOpen) && (
                      <motion.span
                        layoutId="navUnderline"
                        className={`absolute left-3 right-3 -bottom-[1.5px] h-[3px] ${isRouteActive ? "bg-flame" : "bg-ink"}`}
                        transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                      />
                    )}
                  </Link>

                  <AnimatePresence>
                    {isTabOpen && tab.hasDropdown && tab.subItems && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        onMouseEnter={() => {
                          if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        }}
                        className={`absolute top-full mt-[1.5px] w-[22rem] bg-paper-card border-[1.5px] border-ink shadow-hard z-[100] ${dropdownAlignClass}`}
                      >
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
                            className="group/item flex items-start gap-3 px-4 py-3 border-b border-ink/10 last:border-b-0 hover:bg-sun-soft transition-colors"
                          >
                            <span className="font-mono text-[11px] text-flame pt-0.5">{String(idx + 1).padStart(2, "0")}</span>
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="text-[14px] font-semibold text-ink">{item.title}</span>
                                {item.badge && (
                                  <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-ink">{item.badge}</span>
                                )}
                              </span>
                              <span className="block text-[12px] text-ink-2 mt-0.5 leading-snug">{item.desc}</span>
                            </span>
                            <span className="text-ink-3 group-hover/item:text-ink group-hover/item:translate-x-0.5 transition">→</span>
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          {/* Network + wallet */}
          <div className="flex items-center gap-3 shrink-0">
            <NetworkSwitch className="hidden sm:inline-flex" />
            {network === "magicblock" ? (
              <SolanaWalletButton />
            ) : (
              <>
                {isWrongNetwork && (
                  <button onClick={handleSwitchNetwork} className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1.5 border-[1.5px] border-flame text-flame">
                    Switch to Monad
                  </button>
                )}
                <button onClick={handleConnect} disabled={connecting} className="btn-neon btn-sm disabled:opacity-50 whitespace-nowrap">
                  <span>{connecting ? "Connecting…" : address ? formattedAddress : "Connect wallet"}</span>
                </button>
              </>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-10 h-10 border-[1.5px] border-ink flex flex-col items-center justify-center gap-1.5"
              aria-label="Toggle navigation menu"
            >
              <motion.span animate={mobileMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }} className="w-4 h-[2px] bg-ink block" />
              <motion.span animate={mobileMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }} className="w-4 h-[2px] bg-ink block" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            data-lenis-prevent
            className="lg:hidden overflow-hidden bg-paper-card border-b-[1.5px] border-ink"
          >
            <div className="max-h-[75vh] overflow-y-auto">
              <div className="px-5 py-3 border-b border-ink/10 sm:hidden">
                <NetworkSwitch />
              </div>
              {NAV_TABS.map((tab) => {
                const isAccordionOpen = mobileActiveAccordion === tab.id;
                if (!tab.hasDropdown) {
                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-5 py-4 border-b border-ink/10 font-display text-2xl"
                    >
                      {tab.label}
                    </Link>
                  );
                }
                return (
                  <div key={tab.id} className="border-b border-ink/10">
                    <button
                      onClick={() => setMobileActiveAccordion(isAccordionOpen ? null : tab.id)}
                      className="w-full px-5 py-4 flex items-center justify-between font-display text-2xl"
                    >
                      {tab.label}
                      <span className={`font-mono text-sm transition-transform ${isAccordionOpen ? "rotate-45 text-flame" : ""}`}>+</span>
                    </button>
                    {isAccordionOpen && tab.subItems && (
                      <div className="pb-3">
                        {tab.subItems.map((item, idx) => (
                          <Link
                            key={idx}
                            href={item.href}
                            onClick={(e) => {
                              handleAnchorClick(e, item.href);
                              setMobileMenuOpen(false);
                            }}
                            className="flex items-center gap-3 px-5 py-2 text-[14px] text-ink-2 hover:text-ink"
                          >
                            <span className="font-mono text-[11px] text-flame">{String(idx + 1).padStart(2, "0")}</span>
                            {item.title}
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
