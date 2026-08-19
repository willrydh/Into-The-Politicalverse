import { parties } from "@/lib/parties";
import { PartyMark } from "@/components/party-mark";

const indicators = [
  ["National swing", "Election-to-election movement", "COMING ONLINE"],
  ["Geographic breadth", "Strength across Sweden's municipalities", "COMING ONLINE"],
  ["Relative strength", "Local performance vs national baseline", "COMING ONLINE"],
  ["Turnout trend", "Participation through election cycles", "COMING ONLINE"],
];

export default function Home() {
  return (
    <main>
      <header className="topbar shell">
        <a className="brand" href="#">INTO THE <strong>POLITICALVERSE</strong></a>
        <nav aria-label="Primary navigation">
          <a href="#overview">Overview</a><a href="#charts">Charts</a><a href="#parties">Parties</a><a href="#indicators">Indicators</a>
        </nav>
        <span className="live"><i /> DATA SYSTEM</span>
      </header>

      <section className="hero shell" id="overview">
        <div className="eyebrow">SWEDEN · GENERAL ELECTION 2026</div>
        <h1>Politics,<br/><em>quantified.</em></h1>
        <p>Explore Swedish elections through official data, geographic patterns and transparent quantitative indicators.</p>
        <div className="actions"><a className="primary" href="#charts">Explore charts</a><a className="secondary" href="#methodology">How the data works</a></div>
      </section>

      <section className="partyRail shell" id="parties" aria-label="Swedish parliamentary parties">
        {parties.map((party) => <button key={party.id}><PartyMark party={party}/><span>{party.shortName}</span></button>)}
      </section>

      <section className="feature shell" id="charts">
        <div className="featureHeader"><div><span className="kicker">ELECTION EXPLORER</span><h2>Every election tells a longer story.</h2></div><span className="sourceBadge">OFFICIAL DATA · VALMYNDIGHETEN</span></div>
        <div className="chartPlaceholder">
          <div className="chartCopy"><strong>Historical party performance</strong><span>2002 → 2022 · Riksdag</span></div>
          <div className="chartGrid" aria-label="Chart data pipeline placeholder"><span>Official historical election data is being connected.</span></div>
        </div>
      </section>

      <section className="indicators shell" id="indicators">
        <div className="sectionTitle"><span className="kicker">POLITICALVERSE INDICATORS</span><h2>Signals, not slogans.</h2><p>Derived metrics will always expose their source data and calculation method.</p></div>
        <div className="indicatorGrid">{indicators.map(([name, desc, state], i) => <article key={name}><span className="index">0{i+1}</span><h3>{name}</h3><p>{desc}</p><small>{state}</small></article>)}</div>
      </section>

      <section className="method shell" id="methodology"><div><span className="kicker">DATA PROVENANCE</span><h2>No mystery numbers.</h2></div><p>Every value in Politicalverse is classified as <b>Official</b>, <b>Derived</b> or <b>Model</b>. Official values retain their authority, dataset, source URL and ingestion timestamp. Derived indicators publish their methodology.</p></section>

      <footer className="shell"><span>INTO THE POLITICALVERSE</span><span>Quantitative election analysis · Sweden</span></footer>
    </main>
  );
}