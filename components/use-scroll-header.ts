"use client";

import { useEffect, useRef } from "react";
import { advanceScrollHeader, createScrollHeaderState, releasedHeaderY } from "@/lib/ui/scroll-header";

export function useScrollHeader(pathname: string, pinned = false) {
  const ref = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(pinned);
  const revealRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const nativeTimeline = CSS.supports("animation-timeline: scroll(root block)");
    header.dataset.scrollDriver = nativeTimeline ? "timeline" : "frame";
    let state = createScrollHeaderState(window.scrollY);
    let headerHeight = 0, maxScroll = 0, frame = 0;
    let releasedY: number | null = null;
    let animation: Animation | null = null;
    let keyboardFocus = !!header.querySelector(":focus-visible");

    function cancelAnimation() {
      animation?.cancel();
      animation = null;
    }

    function setOffscreen(offscreen: boolean) {
      const value = String(offscreen);
      if (header!.dataset.offscreen === value) return;
      header!.dataset.offscreen = value;
      header!.inert = offscreen;
    }

    function returnToFlow(y: number) {
      cancelAnimation();
      releasedY = null;
      header!.dataset.position = "flow";
      header!.style.removeProperty("--header-release-y");
      header!.style.removeProperty("--header-scroll-y");
      setOffscreen(y >= headerHeight);
    }

    function float(instant = false) {
      // Read once at a direction change, before any positioning/animation writes.
      const from = instant ? 0 : Math.max(-headerHeight, Math.min(0, header!.getBoundingClientRect().top));
      cancelAnimation();
      releasedY = null;
      // Also supplies the initial position before a native timeline is sampled.
      header!.style.setProperty("--header-scroll-y", `${Math.max(0, window.scrollY)}px`);
      header!.dataset.position = "floating";
      header!.style.removeProperty("--header-release-y");
      setOffscreen(false);
      if (from < 0 && !reducedMotion.matches) {
        animation = header!.animate(
          [{ transform: `translateY(${from}px)` }, { transform: "translateY(0)" }],
          { duration: 180, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
      }
    }

    function release(y: number, anchorY: number) {
      // Start from the painted position, including an interrupted entry, and
      // account for any scroll beyond the threshold before this event arrived.
      releasedY = releasedHeaderY(y, anchorY, header!.getBoundingClientRect().top);
      cancelAnimation();
      header!.style.setProperty("--header-release-y", `${releasedY}px`);
      header!.dataset.position = "released";
      header!.style.removeProperty("--header-scroll-y");
    }

    function showImmediately() {
      state = createScrollHeaderState(window.scrollY, true);
      float(true);
    }
    revealRef.current = showImmediately;

    function measure() {
      const nextHeight = header!.offsetHeight;
      const nextMax = Math.max(0, root.scrollHeight - root.clientHeight);
      if (nextHeight !== headerHeight || nextMax !== maxScroll) {
        headerHeight = nextHeight;
        maxScroll = nextMax;
        root.style.setProperty("--site-header-height", `${headerHeight}px`);
        root.style.setProperty("--site-scroll-range", `${maxScroll}px`);
        state = createScrollHeaderState(Math.min(window.scrollY, maxScroll), state.floating);
      }
    }

    measure();
    returnToFlow(window.scrollY);
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(document.body);

    function update() {
      frame = 0;
      const y = window.scrollY;
      if (!Number.isFinite(y) || y < 0 || y > maxScroll) return;
      // Older browsers use the same document positioning, with one compositor
      // property write per scroll frame and no scroll-time layout measurement.
      if (state.floating && !nativeTimeline) header!.style.setProperty("--header-scroll-y", `${y}px`);
      const next = advanceScrollHeader(state, y, { headerHeight, maxScroll, pinned: pinnedRef.current || keyboardFocus });
      if (next.floating !== state.floating) {
        if (next.floating) float();
        else if (y <= 0) returnToFlow(y);
        else release(y, state.anchorY);
      }
      state = next;
      if (!state.floating) {
        if (releasedY !== null && (y >= releasedY + headerHeight || y <= 0)) returnToFlow(y);
        else setOffscreen(releasedY === null && y >= headerHeight);
      }
    }

    function onScroll() { if (!frame) frame = requestAnimationFrame(update); }
    function onFocus(event: FocusEvent) {
      keyboardFocus = event.target instanceof Element && header!.contains(event.target) && event.target.matches(":focus-visible");
      if (keyboardFocus) showImmediately();
    }
    function onBlur() { keyboardFocus = false; }
    function onKeyDown(event: KeyboardEvent) {
      // Restore controls before native Tab traversal can scroll a hidden link into view.
      if (event.key === "Tab" && !event.metaKey && !event.ctrlKey && !event.altKey) showImmediately();
    }
    function onMotionChange() { if (reducedMotion.matches) cancelAnimation(); }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKeyDown, true);
    reducedMotion.addEventListener("change", onMotionChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKeyDown, true);
      reducedMotion.removeEventListener("change", onMotionChange);
      observer.disconnect();
      cancelAnimationFrame(frame);
      returnToFlow(0);
      root.style.removeProperty("--site-header-height");
      root.style.removeProperty("--site-scroll-range");
      delete header.dataset.scrollDriver;
      revealRef.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    pinnedRef.current = pinned;
    if (pinned) revealRef.current?.();
  }, [pathname, pinned]);
  return ref;
}
