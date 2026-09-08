"use client";

import { useEffect, useRef } from "react";
import { advanceScrollHeader, createScrollHeaderState, type ScrollHeaderState } from "@/lib/ui/scroll-header";

export function useScrollHeader(pathname: string, pinned = false) {
  const ref = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(pinned);
  const revealRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const positioner = ref.current;
    if (!positioner) return;
    const surface = positioner.querySelector<HTMLElement>(".site-header");
    const utility = positioner.querySelector<HTMLElement>(".site-header__utility");
    const location = positioner.querySelector<HTMLElement>(".site-location");
    if (!surface || !utility || !location) return;
    const root = document.documentElement;
    const mobileViewport = window.matchMedia("(max-width: 980px)");
    let mobile = mobileViewport.matches;
    let state = createScrollHeaderState(window.scrollY);
    let maxScroll = 0, utilityHeight = 0, surfaceHeight = 0, visibleHeight = -1, frame = 0;
    let keyboardFocus = !!positioner.querySelector(":focus-visible");

    function render(next: ScrollHeaderState) {
      const compact = !mobile && next.y >= utilityHeight && utilityHeight > 0;
      if (positioner!.dataset.compact !== String(compact)) {
        positioner!.dataset.compact = String(compact);
        utility!.inert = compact;
      }
      const height = surfaceHeight - (compact ? utilityHeight : 0);
      if (height !== visibleHeight) {
        root.style.setProperty("--site-header-height", `${height}px`);
        visibleHeight = height;
      }
      if (positioner!.dataset.hidden !== String(next.hidden)) {
        positioner!.dataset.hidden = String(next.hidden);
        positioner!.inert = next.hidden;
      }
      state = next;
    }
    function reveal() {
      render(createScrollHeaderState(Math.min(maxScroll, Math.max(0, window.scrollY))));
    }
    revealRef.current = reveal;
    function update() {
      frame = 0;
      render(advanceScrollHeader(state, window.scrollY, { maxScroll, revealUntil: mobile ? 0 : utilityHeight, pinned: pinnedRef.current || keyboardFocus }));
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(update); }
    function measure() {
      mobile = mobileViewport.matches;
      utilityHeight = utility!.offsetHeight;
      // Mobile sticks only the toolbar; the breadcrumb stays in normal flow.
      // Desktop sticks the wrapper containing both navigation and breadcrumbs.
      surfaceHeight = mobile ? surface!.offsetHeight : positioner!.offsetHeight;
      positioner!.style.setProperty("--site-header-utility-height", `${utilityHeight}px`);
      maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      // Toolbar and content resizing must not trigger a direction change.
      state = { ...state, y: Math.min(maxScroll, Math.max(0, window.scrollY)) };
      render(state);
    }
    function onFocus(event: FocusEvent) {
      keyboardFocus = event.target instanceof Element && positioner!.contains(event.target) && event.target.matches(":focus-visible");
      if (keyboardFocus) reveal();
    }
    function onBlur() { keyboardFocus = false; }
    function onKeyDown(event: KeyboardEvent) {
      // Reveal the available navigation before native keyboard traversal.
      if (event.key === "Tab" && !event.metaKey && !event.ctrlKey && !event.altKey) reveal();
    }

    measure();
    render(state);
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    observer.observe(location);
    observer.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("keydown", onKeyDown, true);
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.style.removeProperty("--site-header-height");
      revealRef.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    const wasPinned = pinnedRef.current;
    pinnedRef.current = pinned;
    if (pinned || wasPinned) revealRef.current?.();
  }, [pathname, pinned]);
  return ref;
}
