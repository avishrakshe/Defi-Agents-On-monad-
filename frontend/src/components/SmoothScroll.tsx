"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { motion, useScroll, useSpring } from "framer-motion";
import { setLenis } from "../lib/smooth-scroll";

/**
 * Site-wide inertial smooth scrolling (Lenis) plus a lime scroll-progress hairline.
 * Disabled automatically for users who prefer reduced motion.
 */
export const SmoothScroll: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      autoRaf: true,
      anchors: { offset: -96 }
    });
    setLenis(lenis);

    return () => {
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[3px] origin-left z-[200] bg-flame pointer-events-none"
    />
  );
};
