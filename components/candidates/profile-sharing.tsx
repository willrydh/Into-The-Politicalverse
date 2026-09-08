"use client";
import { useEffect } from "react";
import { PUBLIC_SITE_URL } from "@/lib/brand";
import { candidateSharingData } from "@/lib/candidates/sharing-data";
import { candidateShareMetadata } from "@/lib/candidates/sharing-metadata";
import { selectShareScope, type ShareLocale } from "@/lib/candidates/sharing";
import type { Person } from "@/lib/candidates/types";

// Keep browser/PWA sharing in sync with the same payload and image revision
// that crawlers receive at the edge. React retains ownership of its head nodes.
export function ProfileSharing({ person, election, area, locale }: { person: Person; election: string; area: string; locale: ShareLocale }) {
  useEffect(() => {
    let active = true;
    let restore = () => {};
    async function sync() {
      const payload = candidateSharingData(person);
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
      if (!active) return;
      const share = { ...payload, revision: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("") };
      const scope = selectShareScope(share, new URLSearchParams({ election, area }));
      const metadata = candidateShareMetadata(PUBLIC_SITE_URL.replace(/\/$/, ""), share, scope, locale);
      const oldTitle = document.title;
      const undo: (() => void)[] = [];
      for (const { tag, selector, attributes } of metadata.tags) {
        let element = document.head.querySelector(selector);
        if (!element) {
          element = document.createElement(tag);
          document.head.append(element);
          const added = element;
          undo.push(() => added.remove());
        } else {
          const existing = element;
          const before = Object.fromEntries(Object.keys(attributes).map(key => [key, existing.getAttribute(key)]));
          undo.push(() => { for (const [key, value] of Object.entries(before)) if (existing.getAttribute(key) === attributes[key]) { if (value === null) existing.removeAttribute(key); else existing.setAttribute(key, value); } });
        }
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      }
      document.title = metadata.title;
      restore = () => { undo.forEach(fn => fn()); if (document.title === metadata.title) document.title = oldTitle; };
    }
    // Sharing never blocks the profile if Web Crypto is unavailable.
    void sync().catch(() => {});
    return () => { active = false; restore(); };
  }, [person, election, area, locale]);
  return null;
}
