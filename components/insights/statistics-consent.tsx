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
    <div>
      <h2 id="statistics-heading">{opened ? (sv ? "Statistikval" : "Statistics preferences") : (sv ? "Politicalverse är gratis för alla" : "Politicalverse is free for everyone")}</h2>
      <p>{sv ? "Genom att godkänna tillåter du vår besöksstatistik, som hjälper oss att förstå hur sajten används och fortsätta utveckla den. Ingen annonsspårning eller inspelning av skärmen." : "By accepting, you allow our visitor statistics, helping us understand how the site is used and continue improving it. No advertising tracking or screen recordings."} <Link href={sv ? "/privacy/" : "/en/privacy/"}>{sv ? "Läs mer" : "Learn more"}</Link></p>
    </div>
    <div className={styles.actions}>
      {opened && <button type="button" onClick={() => choose("denied")}>{sv ? "Avstå" : "Decline"}</button>}
      <button type="button" onClick={() => choose("granted")}>{sv ? "Godkänn" : "Accept"}</button>
      {opened && <button type="button" onClick={() => setOpened(false)}>{sv ? "Stäng" : "Close"}</button>}
    </div>
  </aside>;
}
export function StatisticsSettings() { const sv = useLocale() === "sv"; return <button className={styles.settings} type="button" onClick={() => window.dispatchEvent(new Event("pv-open-consent"))}>{sv ? "Statistikval" : "Statistics preferences"}</button>; }
