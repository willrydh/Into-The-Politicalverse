"use client";

import { useEffect, useRef } from "react";

export function useScrollHeader(pathname: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const position = () => Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
    let previous = position(), anchor = previous, direction = 0, frame = 0;
    header.dataset.hidden = "false";
    const measure = () => document.documentElement.style.setProperty("--site-header-height", `${header.offsetHeight}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    measure();
    function update() {
      frame = 0;
      const y = position();
      const nextDirection = Math.sign(y - previous);
      header!.dataset.scrolled = String(y > 8);
      if (y <= header!.offsetHeight || header!.querySelector(":focus-visible")) {
        header!.dataset.hidden = "false";
        anchor = y;
      } else if (nextDirection) {
        if (nextDirection !== direction) anchor = previous;
        // Small thresholds reject trackpad jitter without delaying an upward reveal.
        if (Math.abs(y - anchor) >= (nextDirection < 0 ? 4 : 12)) {
          header!.dataset.hidden = String(nextDirection > 0);
          anchor = y;
        }
      }
      if (nextDirection) direction = nextDirection;
      previous = y;
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(update); }
    function onFocus() { header!.dataset.hidden = "false"; }
    window.addEventListener("scroll", onScroll, { passive: true });
    header.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("scroll", onScroll);
      header.removeEventListener("focusin", onFocus);
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--site-header-height");
    };
  }, [pathname]);
  return ref;
}
