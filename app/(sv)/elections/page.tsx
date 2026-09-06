import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { DataSource } from "@/components/data-source";
import { PartyMark } from "@/components/party-mark";
import { nationalHistory } from "@/lib/data/elections";
import { PARTIES } from "@/lib/data/elections/parties";
import type { PartyId } from "@/lib/data/elections/types";
import { ARCHIVE_MAJORITY, ARCHIVE_TOTAL_SEATS, electionArchive, getElectionOutcome } from "@/lib/elections/outcomes";

export const metadata: Metadata = { title: "Valarkiv" };

export default function ElectionsPage({ locale = "sv" }: { locale?: Locale } = {}) {
  const sv = locale === "sv";
  const f = (n: number, decimals = 0) => new Intl.NumberFormat(sv ? "sv-SE" : "en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
  const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(sv ? "sv-SE" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const codes = (parties: PartyId[], year: number) => parties.map(p => p === "L" && year <= 2014 ? "FP" : p).join(" + ");
  const elections = [...nationalHistory.elections].reverse();
  return localizeNode((
    <div className="interior-page">
      <header className="interior-hero interior-hero--elections">
        <div><p className="eyebrow eyebrow--light">{sv ? "Valarkiv · Sverige" : "Election archive · Sweden"}</p><h1>{sv ? "Valen. Blocken." : "The vote."}<br /><em>{sv ? "Makten." : "The balance of power."}</em></h1></div>
        <div className="interior-hero__context"><p className="interior-hero__deck">{sv ? "Följ blockens mandat och regeringen som tog form efter varje riksdagsval sedan 2002." : "Explore the blocs’ seats and the government that emerged after each Riksdag election since 2002."}</p><DataSource compact /></div>
      </header>
      <section className="election-archive" aria-label={sv ? "Valresultat och regeringsbildning" : "Election results and government formation"}>
        <div className="archive-intro"><p>{sv ? "Egen majoritet kräver 175 av 349 mandat. Största parti och största block redovisas var för sig, tillsammans med regeringen efter valet." : "A majority requires 175 of 349 seats. The largest party and largest bloc are shown separately, alongside the government following the election."}</p><nav aria-label={sv ? "Välj valår" : "Choose an election year"}>{elections.map(e => <a key={e.year} href={`#election-${e.year}`}>{e.year}</a>)}</nav></div>
        {elections.map(election => {
          const result = getElectionOutcome(election.year);
          const leader = result.leaders.length === 1 ? result.leaders[0] : undefined;
          const largestParty = [...election.parties].sort((a, b) => b.share - a.share)[0];
          const party = PARTIES[largestParty.partyId];
          const government = result.government;
          return <article className="archive-election" id={`election-${election.year}`} key={election.year} aria-labelledby={`election-title-${election.year}`}>
            <header className="archive-year"><span className="mini-label">{sv ? "Riksdagsval" : "Riksdag election"}</span><h2 id={`election-title-${election.year}`}>{election.year}</h2><time dateTime={election.electionDate}>{date(election.electionDate)}</time></header>
            <div className="archive-content">
              <div className="archive-outcomes">
                <section className="archive-blocs" data-classification="DERIVED" aria-label={sv ? "Blockresultat" : "Bloc result"}>
                  <span className="mini-label">{sv ? "Blockresultat · beräknat från mandat" : "Bloc result · derived from seats"}</span>
                  <h3>{leader?.name[locale] ?? (sv ? "Delat största block" : "Tied largest blocs")}</h3>
                  <div className="archive-seat-result"><strong>{f(result.leaders[0].seats)}<small> / {ARCHIVE_TOTAL_SEATS}</small></strong><span className={`archive-majority${result.majority ? " is-majority" : ""}`}>{result.majority ? (sv ? "Egen majoritet" : "Majority") : (sv ? "Ingen blockmajoritet" : "No bloc majority")}</span></div>
                  <p className="archive-result-label">{sv ? "Flest mandat i jämförelsen" : "Most seats in the comparison"}</p>
                  <div className="archive-seat-chart" role="img" aria-label={`${result.blocs.map(b => `${b.name[locale]}: ${b.seats}`).join(", ")}. ${sv ? "Majoritet" : "Majority"}: ${ARCHIVE_MAJORITY}.`}>
                    <div className="archive-seat-bar">{result.blocs.map(b => <span key={b.id} className={`archive-tone-${b.tone}`} style={{ width: `${b.seats / ARCHIVE_TOTAL_SEATS * 100}%` }} />)}</div><i style={{ left: `${ARCHIVE_MAJORITY / ARCHIVE_TOTAL_SEATS * 100}%` }} /><span className="archive-majority-tick" style={{ left: `${ARCHIVE_MAJORITY / ARCHIVE_TOTAL_SEATS * 100}%` }}>{ARCHIVE_MAJORITY} · {sv ? "majoritet" : "majority"}</span>
                  </div>
                  <dl className="archive-bloc-totals">{result.blocs.map(b => <div key={b.id}><dt><i className={`archive-tone-${b.tone}`} /><span>{b.name[locale]}{b.name[locale] !== codes(b.parties, election.year) && <small>{codes(b.parties, election.year)}</small>}</span></dt><dd>{f(b.seats)} <small>{sv ? "mandat" : "seats"}</small></dd></div>)}</dl>
                </section>
                <section className="archive-government" data-classification="CONTEXT" aria-label={sv ? "Regering efter valet" : "Government after the election"}>
                  <span className="mini-label">{sv ? "Regering efter valet · kontext" : "Government after the election · context"}</span>
                  <div className="archive-prime-minister"><PartyMark party={PARTIES[government.primeMinisterParty]} size="sm" /><h3>{government.primeMinister}<small>{sv ? "Statsminister" : "Prime minister"} · {government.primeMinisterParty}</small></h3></div>
                  <p className="archive-cabinet">{codes(government.parties, election.year)}<span data-classification="DERIVED">{result.governmentMajority ? (sv ? "Majoritetsregering" : "Majority government") : (sv ? "Minoritetsregering" : "Minority government")} · {f(result.governmentSeats)} {sv ? "mandat" : "seats"}</span></p>
                  <p className="archive-formation-date">{government.continued ? (sv ? "Fortsatte efter valet" : "Remained in office after the election") : `${sv ? "Tillträdde" : "Took office"} ${date(government.formationDate!)}`}</p>
                  <p className="archive-context-note">{government.note[locale]}</p>
                </section>
              </div>
              <div className="archive-official" data-classification="OFFICIAL"><span className="mini-label">{sv ? "Officiella valresultat" : "Official election results"}</span><dl><div className="archive-largest-party"><dt>{sv ? "Största parti" : "Largest party"}</dt><dd><PartyMark party={party} size="sm" /><span>{party.name}</span><strong>{f(largestParty.share, 2)}%</strong></dd></div><div><dt>{sv ? "Valdeltagande" : "Turnout"}</dt><dd>{f(election.turnout, 2)}%</dd></div><div><dt>{sv ? "Giltiga röster" : "Valid votes"}</dt><dd>{f(election.validVotes)}</dd></div></dl></div>
              <details className="archive-sources"><summary>{sv ? "Partiernas mandat, källor och blockindelning" : "Party seats, sources and bloc definitions"}</summary><p>{sv ? "Mandaten är slutliga valresultat. Blocken summerar de partier som anges för respektive valår. Regeringsrutan visar den första regeringen efter valet, inklusive en regering som fortsatte; senare skiften under mandatperioden ingår inte. FP är Folkpartiet, som senare bytte namn till Liberalerna (L)." : "Seats are final election results. Each bloc sums the listed parties for that election year. The government panel shows the first government following the election, including a continuing government; later changes during the term are not included. FP is Folkpartiet, later renamed Liberalerna (L)."}</p><table><thead><tr><th>{sv ? "Parti" : "Party"}</th><th>{sv ? "Mandat" : "Seats"}</th></tr></thead><tbody>{Object.entries(result.seats.parties).filter(([, seats]) => seats > 0).map(([id, seats]) => <tr key={id}><th>{codes([id as PartyId], election.year)} · {PARTIES[id as PartyId].name}</th><td>{seats}</td></tr>)}</tbody><tfoot><tr><th>{sv ? "Totalt" : "Total"}</th><td>{ARCHIVE_TOTAL_SEATS}</td></tr></tfoot></table><ul>{[result.seats.sourceId, ...government.sources].map(id => { const source = electionArchive.sources[id]; return <li key={id}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title[locale]} ↗</a></li>; })}</ul></details>
            </div>
          </article>;
        })}
        <p className="archive-review">{sv ? "Källor och blockindelning granskade" : "Sources and bloc definitions reviewed"} {date(electionArchive.reviewedAt)} · {electionArchive.methodVersion}</p>
      </section>
    </div>
  ), locale);
}
