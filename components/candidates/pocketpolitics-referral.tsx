"use client";

import { useLocale } from "../localize";
import styles from "./pocketpolitics-referral.module.css";

export function PocketPoliticsReferral() {
  const locale = useLocale(), sv = locale === "sv";
  const campaign = `utm_source=politicalverse&utm_medium=referral&utm_campaign=candidate_profiles&utm_content=${locale}`;
  const newTab = sv ? " (öppnas i ny flik)" : " (opens in a new tab)";

  return <aside className={styles.card} aria-labelledby="pocketpolitics-heading">
    <div className={styles.content}>
      <p className={styles.brand}>PocketPolitics <span>· {sv ? "av" : "by"} William Rydh</span></p>
      <h2 id="pocketpolitics-heading">{sv ? "Från valresultat till politiska uppdrag." : "Beyond the election. Into public office."}</h2>
      <p className={styles.description}>{sv
        ? "Utforska förtroendevalda, nämnder och arvoden – och handlingarna bakom kommunens beslut."
        : "Explore elected representatives, committees, remuneration and the documents behind local decisions."}</p>
      <p className={styles.scope}>{sv
        ? "Börja med demon för Marks kommun. Full åtkomst med abonnemang."
        : "Start with the Swedish-language demo for Mark municipality. Full access requires a subscription."}</p>
    </div>
    <div className={styles.actions}>
      <a className={styles.primary} href={`https://pocketpolitics.io/?demo=1&${campaign}_demo`} target="_blank" rel="noopener noreferrer">
        {sv ? "Utforska PocketPolitics" : "Explore PocketPolitics"}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>
        <span className={styles.srOnly}>{newTab}</span>
      </a>
      <span className={styles.demoNote}>{sv ? "Prova demon utan konto" : "Try the demo without an account"}</span>
      <a className={styles.secondary} href={`https://pocketpolitics.io/welcome?${campaign}_overview`} target="_blank" rel="noopener noreferrer">
        {sv ? "Se funktioner och abonnemang" : "View features and plans"}<span className={styles.srOnly}>{newTab}</span>
      </a>
    </div>
  </aside>;
}
