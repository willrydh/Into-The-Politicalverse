import { insightCampaign, insightPath, insightSource, type InsightKind } from "./insights";
const CONSENT_KEY = "pv-statistics-v1";
const VISIT_KEY = "pv-visit-v1";
const LAST_PATH_KEY = "pv-last-route-v1";
export type StatisticsConsent = "granted" | "denied" | null;
let memoryOnly = false;
let memoryChoice: {
    choice: Exclude<StatisticsConsent, null>;
    expires: number;
} | null = null;
export function readStatisticsConsent(): StatisticsConsent {
    if (memoryOnly)
        return memoryChoice && memoryChoice.expires > Date.now() ? memoryChoice.choice : null;
    try {
        const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null");
        return value?.expires > Date.now() && ["granted", "denied"].includes(value.choice) ? value.choice : null;
    }
    catch {
        return memoryChoice && memoryChoice.expires > Date.now() ? memoryChoice.choice : null;
    }
}
export function subscribeStatistics(callback: () => void) {
    const storage = (event: StorageEvent) => { if (event.key && event.key !== CONSENT_KEY)
        return; memoryOnly = false; callback(); };
    window.addEventListener("pv-consent", callback);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener("pv-consent", callback); window.removeEventListener("storage", storage); };
}
export function setStatisticsConsent(choice: Exclude<StatisticsConsent, null>) {
    memoryChoice = { choice, expires: Date.now() + 180 * 86400000 };
    try {
        localStorage.setItem(CONSENT_KEY, JSON.stringify(memoryChoice));
        memoryOnly = false;
    }
    catch {
        memoryOnly = true; /* The current document still honours the choice if storage is unavailable. */
    }
    window.dispatchEvent(new CustomEvent("pv-consent", { detail: choice }));
}
let navigate: ((path: string) => void) | undefined;
export function recordInsightNavigation(path: string) { navigate?.(path); }
export function startInsights() {
    // Production only: local development and the old GitHub URL never pollute stats.
    if (location.origin !== "https://politicalverse.se" || readStatisticsConsent() !== "granted")
        return () => { };
    let stopped = false, visit = "", current = insightPath(location.pathname), previous = "";
    let visitExpires = 0;
    let lastTick = performance.now(), lastAction = Date.now(), lastEvent = 0, heartbeat: ReturnType<typeof setInterval> | undefined;
    const cleanup: Array<() => void> = [], depth = new Set<number>();
    let pending = Promise.resolve();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let searched = new WeakSet<Element>();
    const campaign = insightCampaign(location.search), source = campaign.source || insightSource(document.referrer);
    let visible = !document.hidden;
    function getVisit() {
        try {
            const saved = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? "null");
            if (saved && typeof saved.id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(saved.id) && saved.expires > Date.now()) {
                visit = saved.id;
            }
            else {
                visit = crypto.randomUUID();
                previous = "";
                sessionStorage.removeItem(LAST_PATH_KEY);
            }
            sessionStorage.setItem(VISIT_KEY, JSON.stringify({ id: visit, expires: Date.now() + 1800000 }));
        }
        catch {
            if (!visit || visitExpires <= Date.now()) {
                visit = crypto.randomUUID();
                previous = "";
            }
            visitExpires = Date.now() + 1800000;
        }
        return visit;
    }
    function send(kind: InsightKind | "heartbeat" | "leave", label = "", value = 0, elapsed = 0) {
        if (stopped || readStatisticsConsent() !== "granted")
            return;
        const oldVisit = visit, visitId = getVisit();
        if (oldVisit && oldVisit !== visitId && kind !== "page" && !document.hidden)
            send("page");
        if (kind === "page")
            try {
                sessionStorage.setItem(LAST_PATH_KEY, current);
            }
            catch { }
        const payload = { id: crypto.randomUUID(), visit: visitId, consent: true, kind, path: current, previous, label, value, elapsed, source, campaign: campaign.campaign, viewport: `${window.innerWidth}x${window.innerHeight}`, screen: `${screen.width}x${screen.height}`, mode: matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser" };
        const deliver = async () => {
            if (readStatisticsConsent() !== "granted" || (stopped && kind !== "leave"))
                return;
            try {
                await fetch("/insights/collect", { method: "POST", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true, signal: AbortSignal.timeout(5000) });
            }
            catch { /* Missing measurements must not break navigation. */ }
        };
        // Preserve route order during rapid client navigation. Final lifecycle signals
        // use keepalive immediately, because a document may be about to unload.
        if (kind === "leave")
            void deliver();
        else
            pending = pending.then(deliver);
    }
    function event(kind: InsightKind, label = "", value = 0) { const time = Date.now(); if (time - lastEvent < 150)
        return; lastEvent = time; send(kind, label, value); }
    function tick(leave = false) { const t = performance.now(); const elapsed = visible && Date.now() - lastAction < 300000 ? Math.min(45000, Math.max(0, Math.round(t - lastTick))) : 0; lastTick = t; send(leave ? "leave" : "heartbeat", "", 0, elapsed); }
    function listen(type: string, fn: EventListener) { document.addEventListener(type, fn, { passive: true }); cleanup.push(() => document.removeEventListener(type, fn)); }
    async function initialize() {
        try {
            const r = await fetch("/insights/config", { cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(5000) });
            if (!r.ok)
                throw new Error("config_unavailable");
            const config: unknown = await r.json();
            current = insightPath(location.pathname);
            if (stopped || readStatisticsConsent() !== "granted" || !config || typeof config !== "object" || !("exclude" in config) || config.exclude !== false)
                return;
            const nav = (path: string) => { const next = insightPath(path); if (next === current)
                return; tick(); previous = current; current = next; depth.clear(); searched = new WeakSet<Element>(); lastAction = Date.now(); send("page"); };
            getVisit();
            try {
                const saved = sessionStorage.getItem(LAST_PATH_KEY);
                if (saved && insightPath(saved) === saved && saved !== current)
                    previous = saved;
            }
            catch { }
            navigate = nav;
            cleanup.push(() => { if (navigate === nav)
                navigate = undefined; });
            send("page");
            lastTick = performance.now();
            heartbeat = setInterval(() => { if (!document.hidden && Date.now() - lastAction < 300000)
                tick(); }, 30000);
            listen("visibilitychange", () => { if (document.hidden) {
                tick(true);
                visible = false;
            }
            else {
                visible = true;
                lastTick = performance.now();
                lastAction = Date.now();
                tick();
            } });
            const pagehide = () => tick(true);
            window.addEventListener("pagehide", pagehide);
            cleanup.push(() => window.removeEventListener("pagehide", pagehide));
            for (const type of ["pointerdown", "keydown", "touchstart"])
                listen(type, () => { lastAction = Date.now(); });
            listen("scroll", () => { lastAction = Date.now(); const height = document.documentElement.scrollHeight - window.innerHeight; if (height <= 0)
                return; const percent = window.scrollY / height * 100; for (const threshold of [50, 90])
                if (percent >= threshold && !depth.has(threshold)) {
                    depth.add(threshold);
                    send("scroll", String(threshold));
                } });
            listen("click", e => {
                const target = e.target instanceof Element ? e.target : null;
                if (!target || !target.closest("main"))
                    return;
                if (target.closest('[data-insight="pocketpolitics"]')) {
                    event("pocketpolitics", "pocketpolitics.io");
                    return;
                }
                const anchor = target.closest("a");
                if (anchor?.href) {
                    try {
                        const u = new URL(anchor.href);
                        if (u.origin !== location.origin) {
                            const domains = ["val.se", "historik.val.se", "valresultat.svt.se", "scb.se"];
                            const domain = domains.find(d => u.hostname === d || u.hostname.endsWith(`.${d}`));
                            if (domain)
                                event("source_open", domain);
                            else if (u.hostname === "pocketpolitics.io")
                                event("pocketpolitics", "pocketpolitics.io");
                        }
                    }
                    catch { }
                    return;
                }
                if (target.closest(".table-sort-button,[data-insight='table-sort']"))
                    event("table_sort");
                else if (target.closest("[aria-pressed],[data-insight='filter']"))
                    event("filter_change");
            });
            listen("change", e => { if (e.target instanceof HTMLSelectElement && e.target.closest("main"))
                event(e.target.closest(".table-sort-mobile") ? "table_sort" : "filter_change"); });
            listen("input", e => { const input = e.target; if (input instanceof HTMLInputElement && input.type === "search" && input.closest("main") && !searched.has(input)) {
                searched.add(input);
                send("search");
            } });
            // Capture types only. Never transmit error messages, stacks or input values.
            const error = (e: ErrorEvent | Event) => event(e instanceof ErrorEvent ? "script_error" : "resource_error");
            window.addEventListener("error", error, true);
            cleanup.push(() => window.removeEventListener("error", error, true));
            const rejection = () => event("script_error");
            window.addEventListener("unhandledrejection", rejection);
            cleanup.push(() => window.removeEventListener("unhandledrejection", rejection));
            const vital = (m: {
                name: string;
                value: number;
            }) => { if (!stopped && ["LCP", "INP", "CLS"].includes(m.name))
                send(m.name as InsightKind, "", Math.round(m.value * 1000) / 1000); };
            void import("web-vitals").then(({ onLCP, onINP, onCLS }) => { if (!stopped) {
                onLCP(vital);
                onINP(vital);
                onCLS(vital);
            } }).catch(() => { });
        }
        catch {
            if (!stopped && readStatisticsConsent() === "granted")
                retry = setTimeout(() => { void initialize(); }, 30000); /* Keep the public product usable while retrying configuration. */
        }
    }
    const unsubscribe = subscribeStatistics(() => { if (readStatisticsConsent() !== "granted") {
        stop();
        removeStatisticsCookies();
    } });
    void initialize();
    function stop() {
        if (!stopped && visit)
            tick(true);
        stopped = true;
        if (heartbeat)
            clearInterval(heartbeat);
        if (retry)
            clearTimeout(retry);
        cleanup.forEach(fn => fn());
        unsubscribe();
    }
    return stop;
}
export function removeStatisticsCookies() {
    try {
        sessionStorage.removeItem(VISIT_KEY);
        sessionStorage.removeItem(LAST_PATH_KEY);
    }
    catch { }
    for (const part of document.cookie.split(";")) {
        const key = part.trim().split("=")[0];
        if (!/^_ga(?:_|$)/.test(key))
            continue;
        for (const domain of ["", location.hostname, `.${location.hostname}`])
            document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain ? `; Domain=${domain}` : ""}`;
    }
}
