"use client";
import { NowcastProbabilityPanel } from "./nowcast-probability";
import { useLocale } from "../localize";
import { PartyMark } from "../party-mark";
import { PARTIES } from "@/lib/parties";
import { publicNowcast } from "@/lib/nowcast/public";
import { currentProjection } from "@/lib/nowcast/current";
import evaluation from "@/data/normalized/election-nowcast-evaluation-summary.json";
import type { LiveFeed } from "@/lib/live/types";
import { isEstablishedResult } from "@/lib/live/headline-result";

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
  const { probability } = currentProjection(feed, delayed);
  const final = feed.results["final-count"];
  if (final && isEstablishedResult(final)) return <section id="valnattsprognos" className="product-section nowcast-panel" data-classification="OFFICIAL"><h2>{sv ? "Riksdagsvalet är fastställt" : "The Riksdag result is final"}</h2><p>{sv ? "Valnattsprognosen har ersatts av det fastställda resultatet. Jämförelsen med prognosen före valet finns kvar på sidan." : "The election-night projection has been replaced by the final result. The comparison with the pre-election forecast remains on this page."}</p></section>;
  return (
    <section
      id="valnattsprognos"
      className="product-section nowcast-panel"
      data-classification="MODEL"
      data-model-revision={available ? feed.nowcast?.source?.revision : undefined}
      aria-labelledby="nowcast-title"
    >
      <p className="eyebrow eyebrow--dark">
        {sv ? "MODELL · EXPERIMENTELL V2" : "MODEL · EXPERIMENTAL V2"}
      </p>
      <h2 id="nowcast-title">
        {sv ? "Valnattens prognos" : "Election-night projection"}
      </h2>
      <p>
        {sv
          ? "Modellen lär sig hur röstmönstren förändras i olika delar av landet. Räknade röster ligger fast; resten uppskattas."
          : "The model learns how voting patterns are changing across the country. Counted votes stay fixed; the remainder is estimated."}
      </p>
      <NowcastProbabilityPanel
        probability={probability}
        complete={e?.status === "counted"}
      />
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
                ? "Underlaget kan inte verifieras just nu. Officiella resultat finns på valnattsidan."
                : "The model inputs cannot currently be verified. Official results are available on the election-night page."
              : sv
                ? "Prognosen inväntar tillräckligt många jämförbara distrikt, geografisk spridning och stöd för de typer av distrikt som återstår."
                : "The projection waits for enough comparable districts, geographic spread and evidence covering the types of districts still uncounted."}
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
          {e.matchedCoverage < 0.05 && (
            <p className="local-note">
              {sv
                ? "Tidigt underlag · mindre än 5 % av jämförelseunderlaget. Prognosen är särskilt känslig för vilka områden som räknas härnäst."
                : "Early evidence · less than 5% of the comparison baseline. The projection is particularly sensitive to which areas report next."}
            </p>
          )}
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
      <details className="local-details" id="metod">
        <summary>
          {sv
            ? "Så fungerar valnattsprognosen"
            : "How the election-night projection works"}
        </summary>
        <p>
          {sv
            ? "Vi använder distriktens tidigare partifördelning, storlek och valdeltagande för att lära oss olika förändringar. Regionala och kommunala avvikelser vägs in försiktigt. Modellen prövar sina alternativ genom att hålla hela kommuner utanför träningen och förutsäga deras redan räknade resultat. En enklare gemensam förändring används om den fungerar bättre. Oräknade utfall används aldrig i träningen."
            : "Historical party composition, district size and turnout help the model learn different swings. Regional and municipal deviations are partially pooled. The model compares alternatives by withholding entire municipalities from training and predicting their already counted results. It falls back to a common national swing when that performs better. Unreported outcomes never enter training."}
        </p>
        <p>
          {sv
            ? "Minst 50 jämförbara distrikt, 20 kommuner, 8 valkretsar och 1 % av jämförelseunderlaget krävs. Vi kontrollerar också effektiv stickprovsstorlek och hur väl återstående distrikt liknar underlaget. Minst 70 % av räknade ordinarie distrikt måste vara jämförbara. Gränsändringar utan säker jämförelse får kommunens historik och lär inte modellen någon förändring."
            : "At least 50 comparable districts, 20 municipalities, 8 constituencies and 1% of the comparison baseline are required. We also check effective sample size and covariate support for remaining districts. At least 70% of counted ordinary districts must be comparable. Unmatched boundaries use municipal history and do not teach the swing."}
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
            ? "Metoden prövas på 4 631 jämförbara distrikt för valet 2018 och 4 162 för 2022, med tolv konstruerade räkningsordningar per val. Tabellen visar genomsnittligt absolut fel i partiernas röstandelar, i procentenheter. Lägre är bättre. Även fall där publiceringskraven inte uppfylls ingår."
            : "The method is tested on 4,631 comparable districts for 2018 and 4,162 for 2022, with twelve synthetic reporting orders per election. The table shows mean absolute party-share error in percentage points. Lower is better. Cases that do not meet publication requirements are included."}
        </p>
        <table
          className="nowcast-evaluation"
          aria-label={
            sv
              ? "Historiska stresstest, genomsnittligt prognosfel"
              : "Historical stress tests, mean forecast error"
          }
        >
          <thead>
            <tr>
              <th>{sv ? "Underlag" : "Coverage"}</th>
              <th>{sv ? "Tidigare modell" : "Previous model"}</th>
              <th>V2</th>
            </tr>
          </thead>
          <tbody>
            {evaluation.checkpoints
              .filter((c) => c.coverage <= 0.1)
              .map((c) => (
                <tr key={c.coverage}>
                  <td>{f(c.coverage * 100)} %</td>
                  <td>{f(c.nationalMaePp, 2)}</td>
                  <td>{f(c.adaptiveMaePp, 2)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="local-note">
          {sv
            ? "Detta är utvecklingstester på jämförbara fysiska distrikt, inte återspelningar av verklig rapporteringstid. Gränsändringar och uppsamlingsröster ingår inte. Den nya modellen är inte bättre i varje enskild räkningsordning. Testerna visar inte att den slår SVT eller att sannolikheterna är kalibrerade."
            : "These are development tests on comparable physical districts, not actual reporting-time replays. Changed boundaries and collection ballots are excluded. The new model is not better in every individual reporting order. These tests do not establish superiority to SVT or calibrated probabilities."}
        </p>
        {e?.diagnostics && (
          <p className="local-note">
            {sv ? "Aktivt underlag" : "Current evidence"}:{" "}
            {f(e.diagnostics.municipalities)}{" "}
            {sv ? "kommuner" : "municipalities"} ·{" "}
            {f(e.diagnostics.effectiveDistricts)}{" "}
            {sv ? "effektiva distrikt" : "effective districts"} ·{" "}
            {f(e.diagnostics.extrapolatedVoteShare * 100, 1)} %{" "}
            {sv
              ? "av återstående underlag kräver extrapolering"
              : "of remaining exposure requires extrapolation"}
            .
          </p>
        )}
        <p>
          {sv
            ? "Mandaten är modellberäknade med 2026 års valkretsmandat och Sveriges mandatregler. De visas inte om övriga partier kan nå en spärr som den åttapartimodellen inte kan hantera. Förvalsprognosen förblir oförändrad."
            : "Seats use the 2026 constituency allocations and Swedish electoral rules. They are withheld when other parties could cross a threshold outside the eight-party model. The pre-election forecast remains unchanged."}
        </p>
        <p>
          {sv
            ? "Vinstsannolikheten är andelen av 1 000 simuleringar som ger minst 175 mandat. Vi varierar återstående partifördelning och röstvolym med historiska felmönster, kommunala testfel och skillnader mellan modellerna. Räknade röster ligger fast. Fördelningsantaganden och ett brusgolv ingår. Sannolikheternas träffsäkerhet har inte belagts eller kalibrerats mot verkliga valnätter."
            : "Win probability is the fraction of 1,000 simulations yielding at least 175 seats. Remaining party composition and vote volume vary using historical error patterns, held-out municipal residuals and differences between models. Counted votes stay fixed. Distributional assumptions and a noise floor remain. Probability accuracy has not been established or calibrated against actual election nights."}
        </p>
        <p>
          {sv
            ? "Politicalverse Nowcast 2 är vår egen statistiska modell. Den bygger vidare på principen att jämföra samma distrikt mellan val, som beskrivs i Vera Policys metodartikel."
            : "Politicalverse Nowcast 2 is our statistical model. It extends the matched-district principle described in Vera Policy’s method article."}{" "}
          <a
            href="https://www.nationalekonomi.se/artikel/nowcasting-pa-valnatten-metod-och-utvardering-fran-valprognos-se/"
            target="_blank"
            rel="noreferrer"
          >
            {sv ? "Läs metodartikeln" : "Read the method article"} ↗
          </a>
        </p>
        <p>
          <a
            href="https://github.com/willrydh/Into-The-Politicalverse/blob/main/docs/methodology/election-nowcast-v2.md"
            target="_blank"
            rel="noreferrer"
          >
            {sv
              ? "Metod, testresultat och efterkontroll"
              : "Method, test results and outcome audit"}{" "}
            ↗
          </a>
        </p>
      </details>
    </section>
  );
}
