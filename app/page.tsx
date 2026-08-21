import Link from "next/link";
import { DataSource } from "@/components/data-source";
import { ElectionCountdown, ElectionCycleProgress } from "@/components/election-countdown";
import { GeographicBreadth } from "@/components/geographic-breadth";
import { IndicatorGrid } from "@/components/indicator-grid";
import { NationalBaseline } from "@/components/charts/national-baseline";
import { NationalTrendChart } from "@/components/charts/national-trend-chart";
import { SectionHeading } from "@/components/section-heading";
import { nationalHistory, riksdag2022 } from "@/lib/data/elections";
import { calculateNationalIndicators } from "@/lib/indicators/national";
import { formatCompactNumber, formatNumber } from "@/lib/format";

const EXPLORE = [
  { index: "01", title: "Charts", copy: "Six elections. Eight parliamentary parties. One comparable national series.", href: "/charts", metric: "48 data points" },
  { index: "02", title: "Parties", copy: "Follow vote share, swing and geographic strength from 2002 to 2022.", href: "/parties", metric: "8 profiles" },
  { index: "03", title: "Maps", copy: "Tap through official Riksdag results across every Swedish municipality.", href: "/maps", metric: "290 places" },
  { index: "04", title: "Elections", copy: "Final results, turnout and participation across every available election.", href: "/elections", metric: "6 elections" },
  { index: "05", title: "Indicators", copy: "Transparent derived measures with the method visible beside the number.", href: "/indicators", metric: "4 live" },
  { index: "06", title: "Simulator", copy: "Set national vote shares and calculate a transparent Riksdag seat scenario.", href: "/simulator", metric: "349 seats" },
];

export default function Home() {
  const indicators = calculateNationalIndicators();

  return (
    <>
      <section className="election-hero">
        <div className="hero-noise" aria-hidden="true" />
        <div className="election-hero__inner">
          <div className="hero-copy">
            <p className="eyebrow eyebrow--light"><span /> Sweden · General election 2026</p>
            <h1>The election,<br /><em>measured.</em></h1>
            <p className="hero-deck">Official results, historical change and geographic patterns across Swedish democracy.</p>
            <div className="hero-actions">
              <Link className="button button--acid" href="/charts">Explore the charts <span>↗</span></Link>
              <DataSource compact />
            </div>
          </div>
          <div className="hero-election-card">
            <div className="hero-election-card__top">
              <span>SE/RD/2026</span><span>Election calendar</span>
            </div>
            <ElectionCountdown />
            <div className="election-date">
              <span>Sunday</span><strong>13 SEP</strong><b>2026</b>
            </div>
            <ElectionCycleProgress />
            <p>Preliminary reporting starts on election night; final official results follow after the count.</p>
          </div>
        </div>
        <div className="hero-proof-strip">
          <div><span>Latest official baseline</span><strong>2022 final</strong></div>
          <div><span>Valid votes</span><strong>{formatCompactNumber(riksdag2022.national.validVotes)}</strong></div>
          <div><span>Reporting districts</span><strong>{formatNumber(riksdag2022.national.districtCount)}</strong></div>
          <div><span>Geographic coverage</span><strong>290 municipalities</strong></div>
          <div className="hero-proof-strip__status"><span className="status-dot status-dot--acid" /><strong>Source verified</strong></div>
        </div>
      </section>

      <section className="product-section product-section--chart">
        <SectionHeading
          eyebrow="National history · 2002—2022"
          title="How Sweden moved"
          aside={<><span className="section-kicker">PV / CHART 001</span><p>Final share of valid votes</p></>}
        />
        <div className="chart-product-grid">
          <NationalTrendChart history={nationalHistory} />
          <NationalBaseline />
        </div>
      </section>

      <section className="product-section product-section--indicators">
        <SectionHeading
          eyebrow="Politicalverse indicators"
          title="Signals, with the method attached"
          aside={<Link className="text-link" href="/indicators">Read methodology <span>→</span></Link>}
        />
        <IndicatorGrid indicators={indicators} />
        <p className="indicator-disclaimer"><span>i</span> Indicators describe change between final election results. They are not polling averages or forecasts.</p>
      </section>

      <section className="product-section product-section--geography">
        <SectionHeading
          eyebrow="Plurality footprint · 2022"
          title="A national result is 290 local stories"
          aside={<><span className="section-kicker">DERIVED · plurality-footprint v1.0.0</span><p>Riksdag plurality by municipality</p></>}
        />
        <GeographicBreadth />
      </section>

      <section className="explore-section">
        <div className="explore-section__intro">
          <p className="eyebrow eyebrow--light">Explore the Politicalverse</p>
          <h2>Start with the<br />evidence.</h2>
          <p>Open access. No account required. Every number links back to an official result and a visible method.</p>
        </div>
        <div className="explore-grid">
          {EXPLORE.map((item) => (
            <Link href={item.href} className="explore-card" key={item.title}>
              <span>{item.index}</span>
              <div><h3>{item.title}</h3><p>{item.copy}</p></div>
              <footer><strong>{item.metric}</strong><b>↗</b></footer>
            </Link>
          ))}
        </div>
      </section>

      <section className="source-band">
        <div><span className="source-band__mark">V</span><p><strong>Built from the official record.</strong><br />Final election results are imported from Valmyndigheten, checksum-verified and normalized without changing the underlying counts.</p></div>
        <a href={riksdag2022.source.sourceUrl} target="_blank" rel="noreferrer">Inspect source file <span>↗</span></a>
      </section>
    </>
  );
}
