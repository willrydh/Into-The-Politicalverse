"use client";

import { useEffect, useRef } from "react";
import { advanceScrollHeader, createScrollHeaderState } from "@/lib/ui/scroll-header";

export function useScrollHeader(pathname: string, pinned = false) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const surface = header.querySelector<HTMLElement>(".site-header__surface");
    if (!surface) return;
    const root = document.documentElement;
    let state = createScrollHeaderState(window.scrollY);
    let headerHeight = 0, maxScroll = 0, frame = 0;
    let keyboardFocus = !!surface.querySelector(":focus-visible");

    function showImmediately() {
      state = createScrollHeaderState(window.scrollY);
      header!.dataset.motion = "instant";
      header!.dataset.hidden = "false";
      surface!.inert = false;
    }

    function measure() {
      const nextHeight = header!.offsetHeight;
      if (nextHeight !== headerHeight) {
        headerHeight = nextHeight;
        root.style.setProperty("--site-header-height", `${headerHeight}px`);
      }
      maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      // Toolbar/keyboard/viewport resizing is not a new scroll direction.
      state = createScrollHeaderState(Math.min(window.scrollY, maxScroll), state.hidden);
    }

    showImmediately();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(document.body);
    measure();
    function update() {
      frame = 0;
      const next = advanceScrollHeader(state, window.scrollY, { headerHeight, maxScroll, pinned: pinned || keyboardFocus });
      if (next.hidden !== state.hidden) {
        header!.dataset.motion = "slide";
        header!.dataset.hidden = String(next.hidden);
        surface!.inert = next.hidden;
      }
      state = next;
    }
    function onScroll() { if (!frame) frame = requestAnimationFrame(update); }
    function onFocus(event: FocusEvent) {
      keyboardFocus = event.target instanceof Element && surface!.contains(event.target) && event.target.matches(":focus-visible");
      if (keyboardFocus) showImmediately();
    }
    function onBlur() { keyboardFocus = false; }
    function onKeyDown(event: KeyboardEvent) {
      // Restore off-screen controls before native Tab traversal, without making
      // the browser scroll a still-translated focused link into the viewport.
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
      root.style.removeProperty("--site-header-height");
      surface.inert = false;
    };
  }, [pathname, pinned]);
  return ref;
}
