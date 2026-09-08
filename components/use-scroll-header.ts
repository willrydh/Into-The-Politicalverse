"use client";

import { useEffect, useRef } from "react";
import { advanceScrollHeader, createScrollHeaderState, type ScrollHeaderState } from "@/lib/ui/scroll-header";

export function useScrollHeader(pathname: string, pinned = false) {
  const ref = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(pinned);
  const revealRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const positioner = ref.current;
    const surface = positioner?.querySelector<HTMLElement>(".site-header");
    if (!positioner || !surface) return;
    const root = document.documentElement;
    let state = createScrollHeaderState(window.scrollY);
    let headerHeight = 0, viewportHeight = 0, maxScroll = 0, frame = 0;
    let keyboardFocus = !!surface.querySelector(":focus-visible");

    function render(next: ScrollHeaderState, y: number) {
      if (next.documentY !== state.documentY) root.style.setProperty("--header-document-y", `${next.documentY}px`);
      const forced = pinnedRef.current || keyboardFocus;
      if (positioner!.dataset.pinned !== String(forced)) positioner!.dataset.pinned = String(forced);
      const offscreen = !forced && y >= next.documentY + headerHeight;
      if (positioner!.dataset.offscreen !== String(offscreen)) {
        positioner!.dataset.offscreen = String(offscreen);
        positioner!.inert = offscreen;
      }
      state = next;
    }

    function showImmediately() {
      render(createScrollHeaderState(Math.min(Math.max(0, window.scrollY), maxScroll), true), window.scrollY);
    }
    revealRef.current = showImmediately;

    function update() {
      frame = 0;
      const y = window.scrollY;
      if (!Number.isFinite(y) || y < 0 || y > maxScroll) return;
      render(advanceScrollHeader(state, y, { headerHeight, maxScroll, pinned: pinnedRef.current || keyboardFocus }), y);
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(update); }

    function measure() {
      const nextHeight = surface!.offsetHeight;
      const nextViewport = root.clientHeight;
      const nextMax = Math.max(0, root.scrollHeight - nextViewport);
      if (nextHeight === headerHeight && nextMax === maxScroll && nextViewport === viewportHeight) return;
      viewportHeight = nextViewport;
      headerHeight = nextHeight;
      maxScroll = nextMax;
      root.style.setProperty("--site-header-height", `${headerHeight}px`);
      // Viewport/toolbar resizing must not count as a change of scroll direction.
      root.style.setProperty("--header-viewport-height", `${viewportHeight}px`);
      state = { ...state, y: Math.min(Math.max(0, window.scrollY), maxScroll) };
      onScroll();
    }

    measure();
    render(state, window.scrollY);
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    observer.observe(document.body);

    function onFocus(event: FocusEvent) {
      keyboardFocus = event.target instanceof Element && positioner!.contains(event.target) && event.target.matches(":focus-visible");
      if (keyboardFocus) showImmediately();
      else onScroll();
    }
    function onBlur() { keyboardFocus = false; onScroll(); }
    function onKeyDown(event: KeyboardEvent) {
      // Restore controls before native Tab traversal can scroll a hidden link.
      if (event.key === "Tab" && !event.metaKey && !event.ctrlKey && !event.altKey) showImmediately();
    }
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
      render(createScrollHeaderState(0), 0);
      root.style.removeProperty("--site-header-height");
      root.style.removeProperty("--header-viewport-height");
      root.style.removeProperty("--header-document-y");
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
