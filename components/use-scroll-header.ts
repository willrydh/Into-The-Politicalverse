"use client";

import { useEffect, useRef } from "react";

export function useScrollHeader(pathname: string, pinned = false) {
  const ref = useRef<HTMLDivElement>(null);
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
      if (pinned || y <= header!.offsetHeight || header!.querySelector(":focus-visible")) {
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
    function onKeyDown(event: KeyboardEvent) {
      // visibility:hidden releases Safari's cached tint, but also removes the
      // controls from tab order. Reveal before the browser moves keyboard focus.
      if (event.key === "Tab" && !event.metaKey && !event.ctrlKey && !event.altKey) onFocus();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    header.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      header.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onKeyDown, true);
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty("--site-header-height");
    };
  }, [pathname, pinned]);
  return ref;
}
