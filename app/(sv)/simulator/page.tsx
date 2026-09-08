import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { ElectionSimulator } from "@/components/simulator/election-simulator";
import { getSimulatorBaseline } from "@/lib/simulator/data";

export const metadata: Metadata = { ...pageMetadata("simulator", "sv"), title: "Mandatsimulator" };

export default function SimulatorPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const baseline = getSimulatorBaseline();

  return localizeNode((
    <div className="interior-page simulator-page">
      <header className="interior-hero interior-hero--simulator">
        <div>
          <p className="eyebrow eyebrow--light">Sweden · Riksdag scenario</p>
          <h1>Move the vote.<br /><em>Count the seats.</em></h1>
        </div>
        <div className="interior-hero__context">
          <p className="interior-hero__deck">Test national vote-share scenarios against Sweden&apos;s electoral rules. The output is a deterministic model—not a poll and not a forecast.</p>
          <div className="interior-hero__aside simulator-hero-facts">
            <strong>349</strong><span>Riksdag seats</span>
            <strong>4.0%</strong><span>National threshold</span>
            <strong>175</strong><span>Majority</span>
          </div>
        </div>
      </header>

      <section className="interior-panel interior-panel--simulator">
        <ElectionSimulator baseline={baseline} />
      </section>

      <section className="simulator-methodology" aria-labelledby="simulator-method-title">
        <div>
          <p className="eyebrow">Method · pv-riksdag-scenario v1.0.0</p>
          <h2 id="simulator-method-title">Rules first. Assumptions visible.</h2>
          <p>The seat engine implements 310 fixed constituency seats, 39 adjustment seats, the modified odd-numbers method with first divisor 1.2, the national 4% threshold and the constituency-only 12% rule.</p>
        </div>
        <div className="simulator-method-grid">
          <article><span>01</span><h3>Official structure</h3><p>The 2026 number of fixed seats in each of Sweden&apos;s 29 constituencies comes from Valmyndigheten.</p></article>
          <article><span>02</span><h3>Geographic projection</h3><p>Each entered national share retains that party&apos;s 2022 distribution between constituencies. This is the model assumption—not an official fact.</p></article>
          <article><span>03</span><h3>Backtested engine</h3><p>The same independent rule engine exactly reproduces the official 2018 and 2022 fixed, adjustment and total seat outcomes.</p></article>
          <article><span>04</span><h3>Not a forecast</h3><p>No polling, probability or uncertainty model is present. The page answers “what if these shares occurred?” only.</p></article>
        </div>
        <div className="simulator-source-links">
          <a href={baseline.rules.methodUrl} target="_blank" rel="noreferrer">Valmyndigheten: seat allocation method <span>↗</span></a>
          <a href={baseline.rules.lawUrl} target="_blank" rel="noreferrer">Vallag (2005:837), chapter 14 <span>↗</span></a>
          <a href="#simulator-method-title">Politicalverse methodology <span>↑</span></a>
        </div>
      </section>
    </div>
  ), locale);
}
