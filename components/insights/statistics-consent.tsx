"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "../localize";
import { readStatisticsConsent, recordInsightNavigation, removeStatisticsCookies, setStatisticsConsent, startInsights, subscribeStatistics, type StatisticsConsent as StatisticsChoice } from "@/lib/insights-client";
import styles from "./statistics-consent.module.css";
const subscribeHydration = () => () => { };
const clientHydrated = () => true;
const serverHydrated = () => false;
const serverChoice = (): StatisticsChoice => null;
export function StatisticsConsent() {
    const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
    const sv = useLocale() === "sv", path = usePathname();
    const choice = useSyncExternalStore(subscribeStatistics, readStatisticsConsent, serverChoice);
    const [opened, setOpened] = useState(false);
    useEffect(() => { if (choice === "granted")
        return startInsights(); }, [choice]);
    useEffect(() => { recordInsightNavigation(path); }, [path]);
    useEffect(() => { const open = () => setOpened(true); window.addEventListener("pv-open-consent", open); return () => window.removeEventListener("pv-open-consent", open); }, []);
    function choose(next: Exclude<StatisticsChoice, null>) { setStatisticsConsent(next); setOpened(false); if (next === "denied") {
        removeStatisticsCookies();
    } }
    if (!hydrated || (choice && !opened))
        return null;
    return <aside className={styles.banner} aria-labelledby="statistics-heading">
    <div><h2 id="statistics-heading">{sv ? "Hjälp oss förstå vad som fungerar" : "Help us understand what works"}</h2><p>{sv ? "Med ditt tillstånd mäter vi besök, sidflöden och teknisk kvalitet med vår egen statistik. Ingen annonsspårning eller inspelning av skärmen." : "With your permission, we measure visits, navigation and technical quality using our own statistics. No advertising tracking or screen recordings."} <Link href={sv ? "/privacy/" : "/en/privacy/"}>{sv ? "Läs mer" : "Learn more"}</Link></p></div>
    <div className={styles.actions}><button type="button" onClick={() => choose("denied")}>{sv ? "Avstå" : "Decline"}</button><button type="button" onClick={() => choose("granted")}>{sv ? "Tillåt statistik" : "Allow statistics"}</button>{choice && <button type="button" onClick={() => setOpened(false)}>{sv ? "Stäng" : "Close"}</button>}</div>
  </aside>;
}
export function StatisticsSettings() { const sv = useLocale() === "sv"; return <button className={styles.settings} type="button" onClick={() => window.dispatchEvent(new Event("pv-open-consent"))}>{sv ? "Statistikval" : "Statistics preferences"}</button>; }
