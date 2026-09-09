import Image from "next/image";
import Link from "next/link";
import { PocketPoliticsReferral } from "@/components/candidates/pocketpolitics-referral";
import { brandAsset } from "@/lib/brand";
import type { Locale } from "@/lib/i18n/messages";
import { localizedHref } from "@/lib/i18n/translate";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./press.module.css";

export const metadata = { ...pageMetadata("press", "sv"), title: "Press och information" };

const copy = {
  sv: {
    eyebrow: "Press och information",
    heading: "Valdata för", accent: "alla.",
    deck: "Om Politicalverse, underlaget bakom siffrorna och hur du får använda materialet.",
    navigation: "På den här sidan",
    sections: ["Om Politicalverse", "Använd materialet", "Utforska sajten", "Datakällor", "Uppdateringar", "Logotyp"],
    about: [
      "Politicalverse är en oberoende webbplats för svensk valdata och valanalys, skapad och tillhandahållen av William Rydh. Här samlas officiella valresultat, personröster, geografiska jämförelser och en egen valprognos i ett sökbart gränssnitt.",
      "Syftet är att göra det lättare att förstå valen: hur stödet förändras, var partier är starka och hur kandidater presterar över tid. Underlaget ska gå att följa tillbaka till källan, även när Politicalverse räknar fram en jämförelse eller visar en modell.",
      "Sajten är till för väljare och politiskt intresserade, journalister, forskare, analytiker och politiker. Samma data och verktyg är tillgängliga för alla, på svenska och engelska, i mobilen och på datorn. Politicalverse är inte knuten till Valmyndigheten eller något politiskt parti.",
    ],
    creditHeading: "Gratis för alla. För alltid.",
    credit: "Politicalverse tillhandahålls gratis för alla, för alltid, av William Rydh. Du får använda material, data, texter, bilder och insikter från webbplatsen i exempelvis artiklar, rapporter, presentationer och sociala medier.",
    condition: "Det enda villkoret är att ange Politicalverse som källa. Det gäller också material eller insikter som du redan har använt. En länk till den relevanta sidan är uppskattad när formatet tillåter det.",
    sampleLabel: "En källhänvisning kan se ut så här",
    sample: "Källa: Politicalverse (politicalverse.se).",
    creditNote: "Behåll även hänvisningen till den ursprungliga datakällan, till exempel ”Politicalverse, baserat på data från Valmyndigheten”. När du återger en prognos eller jämförelse, ange vilket val, område och datum den gäller. Underliggande källmaterial och partilogotyper behåller sina egna användningsvillkor.",
    features: [
      { title: "Följ personer och topplistor", href: "/rankings/", text: "Jämför personröster, förändring, andel av partiets röster och officiella listplatser i riksdags-, region- och kommunval. Kandidatprofiler visar valhistorik och topplisteplaceringar där underlag finns." },
      { title: "Utforska valen på kartan", href: "/maps/", text: "Gå från län till kommun och valdistrikt. Undersök partiernas riksdagsresultat och historiska förändringar. Personröster visas för det valområde som källan faktiskt redovisar." },
      { title: "Förstå prognosen", href: "/forecasts/", text: "Se beräknade röstandelar, mandat, osäkerhetsintervall och majoritetsscenarier. Metod och datastopp är synliga. I simulatorn kan du pröva egna röstandelar." },
      { title: "Följ valnatten", href: "/valnatt/", text: "Följ officiell rösträkning när resultaten publiceras. Preliminära och slutliga resultat hålls isär. Utfallet kan jämföras med den prognosreferens som sparats före valet." },
    ],
    search: "Sök efter personer, partier och platser",
    sourcesIntro: "Politicalverse samlar och bearbetar data. Sajten genomför inga egna opinionsmätningar och är inte en officiell resultatkälla.",
    sources: [
      { name: "Valmyndigheten", href: "https://www.val.se/", text: "Officiella valresultat, personröster, kandidatlistor och listplatser, mandat och valgeografi. För 2026 används också myndighetens förvalsuppgifter och signerade resultatfiler när de finns publicerade." },
      { name: "SwedishPolls och mätinstituten", href: "https://github.com/MansMeg/SwedishPolls", text: "Prognosens opinionsunderlag hämtas från SwedishPolls sammanställning. Utvalda observationer kontrolleras mot institutens originalpubliceringar och exempelvis SVT och Sveriges Radio. Mätningar, publiceringsdatum och kontroller redovisas i prognosens metodavsnitt." },
      { name: "SCB", href: "https://www.scb.se/", text: "SCB:s officiella tätortsnamn och kommunanknytningar används i sökningen. En tätortslänk öppnar kommunens valresultat; den innebär inte att rösterna har räknats för själva tätorten." },
    ],
    sourcesLink: "Öppna källregistret",
    methodHeading: "Resultat, beräkning och prognos",
    method: "Officiella röster återges från källan. Förändringar och topplistor beräknas av Politicalverse. Prognoser och simuleringar är modeller med antaganden och osäkerhet. Ett mandatunderlag är inte ett besked om vilken regering som bildas.",
    limits: "Kandidatnummer kan ändras mellan val. Historiska personkopplingar görs försiktigt, och osäkra identiteter hålls separata. Saknade uppgifter visas som saknade. Listplats ger viktig bakgrund till personröster, men visar inte hur stor del av resultatet som beror på placeringen.",
    updates: [
      { title: "Opinionsunderlag", text: "Inför valet kontrolleras källan enligt ett schema var sjätte timme. Godkända förändringar leder till en ny prognos. Efter valdagen behålls förvalsprognosen som referens, så att den inte skrivs om med facit i hand." },
      { title: "Valnatten och efterräkningen 2026", text: "Resultathämtningen är förberedd för kontroller ungefär var femte minut den 13–30 september, följt av dagliga kontroller av slutliga protokoll och rättelser under oktober–december. Valnattsvyn kontrollerar den publicerade filen varje minut. Nya siffror beror på myndighetens publicering och kan fördröjas." },
      { title: "Kontroller före publicering", text: "Nya data kontrolleras bland annat för filformat, signaturer där sådana finns, dubbletter och rimliga summeringar. Om en kontroll misslyckas behålls senast godkända data. Historiska rättelser och nya personröstår granskas innan de förs in i profiler och topplistor. Datadatum och status visar vilket underlag du ser." },
    ],
    readiness: "Förberedelserna för 2026 omfattar tester mot Valmyndighetens officiella genrep. De ersätter inte kontroller av riktiga resultatpaket när myndigheten publicerar dem. En fullständig utvärdering av prognosfelet visas först när det slutliga resultatet är komplett.",
    assets: "Använd den ordinarie kronan när du hänvisar till Politicalverse. Behåll färger och proportioner.",
    svg: "Hämta logotyp · SVG", png: "Hämta logotyp · PNG",
  },
  en: {
    eyebrow: "Press and information",
    heading: "Election data for", accent: "everyone.",
    deck: "About Politicalverse, the sources behind the numbers and how to use the material.",
    navigation: "On this page",
    sections: ["About Politicalverse", "Using the material", "Explore the site", "Data sources", "Updates", "Logo"],
    about: [
      "Politicalverse is an independent website for Swedish election data and analysis, created and provided by William Rydh. It brings together official election results, personal votes, geographic comparisons and its own election forecast in a searchable interface.",
      "Its purpose is to make elections easier to understand: how support changes, where parties are strongest and how candidates perform over time. The evidence should be traceable to its source, including when Politicalverse calculates a comparison or presents a model.",
      "The site is for voters and anyone interested in politics, journalists, researchers, analysts and politicians. Everyone has access to the same data and tools, in Swedish and English, on mobile and desktop. Politicalverse is not affiliated with the Swedish Election Authority or any political party.",
    ],
    creditHeading: "Free for everyone. Forever.",
    credit: "Politicalverse is provided free of charge to everyone, forever, by William Rydh. You may use material, data, text, images and insights from the website in articles, reports, presentations and social media, for example.",
    condition: "The only condition is to credit Politicalverse as your source. This also applies to material or insights you have already used. A link to the relevant page is appreciated wherever the format allows it.",
    sampleLabel: "Suggested attribution",
    sample: "Source: Politicalverse (politicalverse.se).",
    creditNote: "Also retain the original data source, for example “Politicalverse, based on data from the Swedish Election Authority”. When reproducing a forecast or comparison, state its election, area and date. Underlying source material and party logos retain their own terms of use.",
    features: [
      { title: "Follow candidates and leaderboards", href: "/rankings/", text: "Compare personal votes, changes, shares of party votes and official ballot positions in parliamentary, regional and municipal elections. Candidate profiles show election history and leaderboard placements where data is available." },
      { title: "Explore elections on the map", href: "/maps/", text: "Move from counties to municipalities and electoral districts. Examine parties’ Riksdag results and historical changes. Personal votes retain the electoral area actually reported by the source." },
      { title: "Understand the forecast", href: "/forecasts/", text: "Explore estimated vote shares, seats, uncertainty intervals and majority scenarios. Methodology and the data cutoff are visible. The simulator lets you try your own vote shares." },
      { title: "Follow election night", href: "/valnatt/", text: "Follow official counting as results are published. Preliminary and final results remain separate. Outcomes can be compared with the forecast reference preserved before the election." },
    ],
    search: "Search for people, parties and places",
    sourcesIntro: "Politicalverse collects and processes data. It does not conduct its own opinion polls and is not an official results service.",
    sources: [
      { name: "Swedish Election Authority", href: "https://www.val.se/", text: "Official election results, personal votes, candidate lists and ballot positions, seats and electoral geography. For 2026, the site also uses the authority’s preparation data and signed result files as they become available." },
      { name: "SwedishPolls and polling organisations", href: "https://github.com/MansMeg/SwedishPolls", text: "The forecast’s polling inputs come from the SwedishPolls compilation. Selected observations are cross-checked against original pollster publications and outlets including SVT and Sveriges Radio. Polls, publication dates and checks are documented in the forecast methodology." },
      { name: "Statistics Sweden (SCB)", href: "https://www.scb.se/", text: "Official urban locality names and municipality links from Statistics Sweden are used in search. A locality link opens municipal election results; it does not mean that votes have been counted for the locality itself." },
    ],
    sourcesLink: "Open the source catalogue",
    methodHeading: "Results, calculations and forecasts",
    method: "Official votes are reproduced from the source. Changes and leaderboards are calculated by Politicalverse. Forecasts and simulations are models with assumptions and uncertainty. A projected seat majority does not establish which government will form.",
    limits: "Candidate numbers can change between elections. Historical identity links are conservative, and uncertain identities remain separate. Missing data stays missing. Ballot position adds useful context to personal votes, but does not establish how much of a result was caused by that position.",
    updates: [
      { title: "Polling inputs", text: "Before the election, a scheduled process checks the source every six hours. Accepted changes produce a new forecast. After election day, the pre-election forecast is retained as a reference so it cannot be rewritten with hindsight." },
      { title: "Election night and the final count in 2026", text: "Result collection is prepared for checks approximately every five minutes from 13–30 September, followed by daily checks for final protocols and corrections during October–December. The election-night view checks the published file every minute. New figures depend on the authority’s publications and may be delayed." },
      { title: "Checks before publication", text: "Incoming data is checked for file format, signatures where available, duplicates and consistent totals, among other things. If a check fails, the last accepted data is retained. Historical corrections and new personal-vote years are reviewed before entering profiles and leaderboards. Data dates and status show which observations you are viewing." },
    ],
    readiness: "Preparations for 2026 include tests against the Swedish Election Authority’s official rehearsals. These do not replace checks of real result packages as the authority publishes them. A full assessment of forecast error is shown only when the final result is complete.",
    assets: "Use the original crown when referring to Politicalverse. Preserve its colours and proportions.",
    svg: "Download logo · SVG", png: "Download logo · PNG",
  },
};

const anchors = ["about", "credit", "explore", "sources", "updates", "logo"];

export default function PressPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const c = copy[locale];
  const href = (path: string) => localizedHref(path, locale);
  return <div className={styles.page}>
    <header className={`interior-hero ${styles.hero}`}>
      <div><p className="eyebrow eyebrow--light">{c.eyebrow}</p><h1>{c.heading}<br /><em>{c.accent}</em></h1></div>
      <p className="interior-hero__deck">{c.deck}</p>
    </header>
    <div className={styles.content}>
      <nav className={styles.contents} aria-label={c.navigation}>
        {c.sections.map((title, i) => <a key={anchors[i]} href={`#${anchors[i]}`}>{title}</a>)}
      </nav>
      <section className={styles.section} id="about" aria-labelledby="about-title">
        <h2 id="about-title">{c.sections[0]}</h2>
        <div className={styles.prose}>{c.about.map(p => <p key={p}>{p}</p>)}</div>
      </section>
      <section className={styles.credit} id="credit" aria-labelledby="credit-title">
        <p className={styles.label}>{c.sections[1]}</p>
        <h2 id="credit-title">{c.creditHeading}</h2>
        <p>{c.credit}</p><p>{c.condition}</p>
        <div className={styles.attribution}><span>{c.sampleLabel}</span><p>{c.sample}</p></div>
        <p className={styles.note}>{c.creditNote}</p>
      </section>
      <section className={styles.section} id="explore" aria-labelledby="explore-title">
        <h2 id="explore-title">{c.sections[2]}</h2>
        <div>
          <div className={styles.features}>{c.features.map(feature => <article key={feature.href}>
            <h3><Link href={href(feature.href)}>{feature.title}<span aria-hidden="true"> ↗</span></Link></h3><p>{feature.text}</p>
          </article>)}</div>
          <Link className={styles.link} href={href("/search/")}>{c.search}<span aria-hidden="true"> →</span></Link>
        </div>
      </section>
      <section className={styles.section} id="sources" aria-labelledby="sources-title">
        <h2 id="sources-title">{c.sections[3]}</h2>
        <div className={styles.prose}>
          <p>{c.sourcesIntro}</p>
          <dl className={styles.sources}>{c.sources.map(source => <div key={source.href}>
            <dt><a href={source.href}>{source.name}<span aria-hidden="true"> ↗</span></a></dt><dd>{source.text}</dd>
          </div>)}</dl>
          <Link className={styles.link} href={href("/sources/")}>{c.sourcesLink}<span aria-hidden="true"> →</span></Link>
          <h3>{c.methodHeading}</h3><p>{c.method}</p><p>{c.limits}</p>
        </div>
      </section>
      <section className={styles.section} id="updates" aria-labelledby="updates-title">
        <h2 id="updates-title">{c.sections[4]}</h2>
        <div className={styles.prose}>{c.updates.map(update => <div key={update.title}><h3>{update.title}</h3><p>{update.text}</p></div>)}<p className={styles.note}>{c.readiness}</p></div>
      </section>
      <section className={styles.section} id="logo" aria-labelledby="logo-title">
        <h2 id="logo-title">{c.sections[5]}</h2>
        <div className={styles.assets}>
          <Image src={brandAsset("politicalverse-logo.svg")} width={80} height={80} alt="Politicalverse" />
          <div><p>{c.assets}</p><div className={styles.downloads}>
            <a href={brandAsset("politicalverse-logo.svg")} download>{c.svg}<span aria-hidden="true"> ↓</span></a>
            <a href={brandAsset("politicalverse-app-icon-1024.png")} download>{c.png}<span aria-hidden="true"> ↓</span></a>
          </div></div>
        </div>
      </section>
      <PocketPoliticsReferral />
    </div>
  </div>;
}
