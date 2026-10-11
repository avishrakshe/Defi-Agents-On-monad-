import type Lenis from "lenis";

let instance: Lenis | null = null;

export const setLenis = (lenis: Lenis | null) => {
  instance = lenis;
};

export const getLenis = () => instance;

/**
 * Smoothly scroll to an element by id. Uses the shared Lenis instance when active
 * (so the scroll keeps Lenis' easing) and falls back to native smooth scrolling.
 * Returns false when the element is not on the current page.
 */
export const scrollToId = (id: string, offset = -96): boolean => {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;

  if (instance) {
    instance.scrollTo(el, { offset, duration: 1.4 });
  } else {
    const top = el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: "smooth" });
  }
  return true;
};
