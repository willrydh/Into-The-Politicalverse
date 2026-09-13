"use client";
import { useLocale } from "../localize";
import { PartyMark } from "../party-mark";
import { PARTIES } from "@/lib/parties";
import { publicNowcast } from "@/lib/nowcast/public";
import type { LiveFeed } from "@/lib/live/types";

export function NowcastPanel({
  feed,
  delayed,
}: {
  feed: LiveFeed;
  delayed: boolean;
}) {
  const sv = useLocale() === "sv";
  const f = (n: number, d = 0) =>
    n.toLocaleString(sv ? "sv-SE" : "en-GB", { maximumFractionDigits: d });
  const e = publicNowcast(feed),
    available = e && e.status !== "insufficient" && !delayed;
  const failed =
    delayed ||
    feed.nowcast?.status === "error" ||
    (feed.nowcast?.status === "ready" && !e);
  return (
    <section
      className="product-section nowcast-panel"
      data-classification="MODEL"
      aria-labelledby="nowcast-title"
    >
      <p className="eyebrow eyebrow--dark">
        {sv ? "MODELL · EXPERIMENTELL" : "MODEL · EXPERIMENTAL"}
      </p>
      <h2 id="nowcast-title">
        {sv ? "Valnattens prognos" : "Election-night projection"}
      </h2>
      <p>
        {sv
          ? "Räknade röster plus en uppskattning av det som återstår, utifrån förändringen i jämförbara distrikt sedan 2022."
          : "Counted votes plus an estimate of the remaining ballots, based on changes in comparable districts since 2022."}
      </p>
      {!available ? (
        <div className="nowcast-waiting" role="status">
          <strong>
            {failed
              ? sv
                ? "Prognosen är tillfälligt pausad"
                : "Projection temporarily paused"
              : e
                ? sv
                  ? "Fler jämförbara distrikt behövs"
                  : "More comparable districts are needed"
                : sv
                  ? "Väntar på räknade distrikt"
                  : "Waiting for counted districts"}
          </strong>
          <p>
            {failed
              ? sv
                ? "Underlaget kan inte verifieras just nu. Officiella resultat redovisas separat ovan."
                : "The model inputs cannot currently be verified. Official results remain separate above."
              : sv
                ? "Prognosen visas när minst 100 jämförbara distrikt från 8 valkretsar täcker minst 5 % av jämförelseunderlaget."
                : "The projection appears once at least 100 comparable districts across 8 constituencies cover at least 5% of the comparison baseline."}
          </p>
          {e && (
            <small>
              {f(e.matchedDistricts)}{" "}
              {sv ? "jämförbara distrikt" : "comparable districts"} ·{" "}
              {f(e.representedConstituencies)}{" "}
              {sv ? "valkretsar" : "constituencies"} ·{" "}
              {f(e.matchedCoverage * 100, 1)} %
            </small>
          )}
        </div>
      ) : (
        <>
          <div className="nowcast-summary">
            <span>
              <strong>{f(e.matchedDistricts)}</strong>{" "}
              {sv ? "jämförbara distrikt" : "comparable districts"}
            </span>
            <span>
              <strong>
                {f(
                  (e.estimatedRemainingVotes /
                    (e.countedVotes + e.estimatedRemainingVotes)) *
                    100,
                  1,
                )}{" "}
                %
              </strong>{" "}
              {sv ? "av röstvolymen uppskattas" : "of vote volume is estimated"}
            </span>
          </div>
          <div
            className="nowcast-table"
            role="table"
            aria-label={
              sv
                ? "Modellprognos jämfört med räknade röster"
                : "Model projection compared with counted votes"
            }
          >
            <div role="row" className="nowcast-table__head">
              <span role="columnheader">{sv ? "Parti" : "Party"}</span>
              <span role="columnheader">
                {sv ? "Prognos, %" : "Projected, %"}
              </span>
              <span role="columnheader">{sv ? "Räknat, %" : "Counted, %"}</span>
              <span role="columnheader">{sv ? "Mandat" : "Seats"}</span>
            </div>
            {[...e.rows]
              .sort((a, b) => b.projectedShare - a.projectedShare)
              .map((row) => (
                <div role="row" key={row.partyId}>
                  <span role="rowheader">
                    {row.partyId === "OTHER" ? (
                      <span>{sv ? "Övr." : "Other"}</span>
                    ) : (
                      <PartyMark party={PARTIES[row.partyId]} size="sm" />
                    )}
                  </span>
                  <span role="cell">
                    <strong>{f(row.projectedShare, 1)}</strong>
                    <small>
                      {f(row.sensitivity[0], 1)}–{f(row.sensitivity[1], 1)}
                    </small>
                  </span>
                  <span role="cell">
                    {row.countedShare === null ? "—" : f(row.countedShare, 1)}
                  </span>
                  <span role="cell">{row.seats ?? "—"}</span>
                </div>
              ))}
          </div>
          <p className="local-note">
            {sv
              ? "Spannet visar modellens känslighet, inte ett statistiskt säkerställt konfidensintervall. Prognosen kan ändras tydligt när andra delar av landet rapporterar."
              : "The range indicates model sensitivity, not a statistically calibrated confidence interval. The projection can shift substantially as other parts of the country report."}
          </p>
          <p className="local-note">
            {sv ? "Källa uppdaterad" : "Source updated"}:{" "}
            {new Date(feed.nowcast!.source!.updatedAt).toLocaleString(
              sv ? "sv-SE" : "en-GB",
              {
                timeZone: "Europe/Stockholm",
                dateStyle: "medium",
                timeStyle: "short",
              },
            )}{" "}
            · {sv ? "svensk tid" : "Swedish time"}
          </p>
        </>
      )}
      <details className="local-details">
        <summary>
          {sv
            ? "Så fungerar valnattsprognosen"
            : "How the election-night projection works"}
        </summary>
        <p>
          {sv
            ? "Vi jämför samma distrikts röstandelar med 2022 och viktar förändringen efter antalet räknade giltiga röster. För oräknade distrikt används förändringen tillsammans med distriktets tidigare resultat och en uppskattning av röstvolymen. Räknade röster ersätter uppskattningarna."
            : "We compare each matched district with 2022 and weight the change by its counted valid votes. For unreported districts, that change is combined with their historical results and an estimated vote volume. Counted votes replace estimates."}
        </p>
        <p>
          {sv
            ? "Ändrade distriktsgränser utan säker jämförelse får kommunens historiska fördelning och används inte för att skatta förändringen. Minst 70 % av de räknade ordinarie distrikten måste vara jämförbara."
            : "Changed boundaries without a verified match use the historical municipal distribution and do not teach the swing. At least 70% of counted ordinary districts must be comparable."}
        </p>
        <p>
          {sv
            ? "Sena röster och utlandsröster i uppsamlingsdistrikt uppskattas separat från 2022 års uppsamlingsröster och kommunens antal röstberättigade. De ersätts successivt av räknade röster. Det är ingen separat observerad utlandsprognos."
            : "Late and overseas ballots in collection districts are estimated separately using 2022 collection votes and changes in the municipal electorate. Counted ballots gradually replace these estimates. This is not a separately observed overseas-vote forecast."}
        </p>
        {available && (
          <p>
            {sv
              ? "Uppskattade återstående uppsamlingsröster"
              : "Estimated remaining collection ballots"}
            : {f(e.estimatedCollectionVotes)}.{" "}
            {sv
              ? "Andel av prognosens röstvolym med kommunbaserad ersättning för distriktsjämförelse"
              : "Share of projected votes using municipal substitutes for district comparisons"}
            : {f(e.imputedRemainingVoteShare * 100, 1)} %.
          </p>
        )}
        <p>
          {sv
            ? "Metoden stresstestas mot 4 162 jämförbara distrikt 2018–2022 i sex konstruerade räkningsordningar. Det är inte en återspelning av den verkliga valnatten och omfattar inte nya gränser eller uppsamlingsröster. Spannen är försiktighetsmått, inte 80- eller 95-procentiga sannolikheter."
            : "The method is stress-tested on 4,162 comparable districts from 2018–2022 using six synthetic reporting orders. This is not an actual election-night replay and excludes changed boundaries and collection ballots. The ranges are sensitivity measures, not 80% or 95% probabilities."}
        </p>
        <p>
          {sv
            ? "Mandaten är modellberäknade med 2026 års valkretsmandat och Sveriges mandatregler. De visas inte om övriga partier kan nå en spärr som den åttapartimodellen inte kan hantera. Förvalsprognosen förblir oförändrad."
            : "Seats use the 2026 constituency allocations and Swedish electoral rules. They are withheld when other parties could cross a threshold outside the eight-party model. The pre-election forecast remains unchanged."}
        </p>
        <p>
          {sv
            ? "Egen implementation, inspirerad av den publicerade principen bakom Vera Policys valnattsprognos. Inte SVT:s modell eller resultat."
            : "An independent implementation inspired by the published principle behind Vera Policy’s election-night projection. Not SVT’s model or results."}{" "}
          <a
            href="https://www.nationalekonomi.se/artikel/nowcasting-pa-valnatten-metod-och-utvardering-fran-valprognos-se/"
            target="_blank"
            rel="noreferrer"
          >
            {sv ? "Läs metodartikeln" : "Read the method article"} ↗
          </a>
        </p>
      </details>
    </section>
  );
}
