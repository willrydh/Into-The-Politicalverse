"use client";
import { Localize, useLocale } from "@/components/localize";
import { useCurrentProjection } from "@/components/live/use-live-feed";
import { officialScenarioInput, publicScenarioInput } from "@/lib/nowcast/scenario";
import { isEstablishedResult } from "@/lib/live/headline-result";
import { useMemo, useState, type CSSProperties } from "react";
import { PartyMark } from "@/components/party-mark";
import { PARTIES } from "@/lib/parties";
import { calculateRiksdagSeats, coalitionSeats } from "@/lib/simulator/riksdag-rules";
import { simulateRiksdagScenario } from "@/lib/simulator/scenario";
import { SIMULATOR_PARTY_IDS, type SimulatorPartyId, type SimulatorPartyVotes } from "@/lib/simulator/types";
import type { SimulatorBaseline } from "@/lib/simulator/data";

function thresholdLabel(status: "national" | "constituency" | "below"): string {
  if (status === "national") return "National threshold";
  if (status === "constituency") return "12% constituency rule";
  return "Below threshold";
}

function shareTotal(shares: SimulatorPartyVotes): number {
  return SIMULATOR_PARTY_IDS.reduce((sum, partyId) => sum + shares[partyId], 0);
}

export function ElectionSimulator({ baseline }: { baseline: SimulatorBaseline }) {
  const { estimate, feed, source } = useCurrentProjection();
  const language = useLocale() === "sv" ? "sv-SE" : "en-GB";
  const sv = language === "sv-SE", final = feed.results["final-count"];
  const official = final && isEstablishedResult(final) ? final : null;
  const input = useMemo(() => official ? officialScenarioInput(feed) : publicScenarioInput(estimate, feed), [estimate, feed, official]);
  const currentBaseline = useMemo(() => input ? {
    ...baseline,
    nationalValidVotes: input.nationalValidVotes,
    constituencies: input.constituencies,
    shares: Object.fromEntries(SIMULATOR_PARTY_IDS.map(p => [p, input.constituencies.reduce((s, c) => s + c.partyVotes[p], 0) / input.nationalValidVotes * 100])) as SimulatorPartyVotes,
  } : null, [baseline, input]);
  const [draft, setDraft] = useState<{ baseline: SimulatorBaseline; shares: SimulatorPartyVotes; updatedAt: string; official: boolean } | null>(null);
  const shares = draft?.shares ?? currentBaseline?.shares ?? Object.fromEntries(SIMULATOR_PARTY_IDS.map(p => [p, 0])) as SimulatorPartyVotes;
  const activeBaseline = draft?.baseline ?? currentBaseline;
  const sourceTime = draft?.updatedAt ?? official?.sourceUpdatedAt ?? source?.updatedAt;
  const fromOfficial = draft?.official ?? Boolean(official);
  const time = sourceTime ? new Date(sourceTime).toLocaleString(language, { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  const [coalition, setCoalition] = useState<SimulatorPartyId[]>([]);
  const modeledTotal = shareTotal(shares);
  const remainingShare = 100 - modeledTotal;
  const simulation = useMemo(() => {
    try {
      if (!activeBaseline) return { output: null, error: "Inväntar verifierade valkretsdata från valnattsprognosen." };
      // The untouched view uses exactly the same integer input as the live model.
      if (!draft && input) return { output: { result: calculateRiksdagSeats(input) }, error: null };
      const output = simulateRiksdagScenario(activeBaseline, shares);
      if (output.otherShare >= 4 || output.input.constituencies.some(c => (c.validVotes - SIMULATOR_PARTY_IDS.reduce((s, p) => s + c.partyVotes[p], 0)) / c.validVotes >= .12)) {
        return { output: null, error: "Övriga partier kan nå en spärr som åttapartimodellen inte kan hantera." };
      }
      return { output, error: null };
    } catch (error) {
      return { output: null, error: error instanceof Error ? error.message : "The scenario could not be calculated" };
    }
  }, [activeBaseline, shares, draft, input]);

  const result = simulation.output?.result ?? null;
  const rankedParties = result ? [...result.parties].sort((left, right) => right.totalSeats - left.totalSeats || SIMULATOR_PARTY_IDS.indexOf(left.partyId) - SIMULATOR_PARTY_IDS.indexOf(right.partyId)) : [];
  const coalitionTotal = result ? coalitionSeats(result, coalition) : 0;
  const qualifyingParties = result?.parties.filter((party) => party.thresholdStatus !== "below").length ?? 0;

  function updateShare(partyId: SimulatorPartyId, value: number): void {
    const next = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value * 100) / 100)) : 0;
    if (!activeBaseline || !sourceTime) return;
    setDraft({ baseline: activeBaseline, shares: { ...shares, [partyId]: next }, updatedAt: sourceTime, official: fromOfficial });
  }

  function toggleCoalition(partyId: SimulatorPartyId): void {
    setCoalition((current) => current.includes(partyId) ? current.filter((candidate) => candidate !== partyId) : [...current, partyId]);
  }

  return <Localize>{(
    <div className="simulator-shell" data-model-revision={!draft ? source?.revision : undefined}>
      <section className="simulator-inputs" aria-labelledby="scenario-input-title">
        <div className="simulator-panel-heading">
          <div>
            <p className="eyebrow">Scenario input</p>
            <h2 id="scenario-input-title">Set national vote share</h2>
          </div>
          <button className="simulator-reset" type="button" onClick={() => setDraft(null)}>{official ? (sv ? "Återställ till valresultatet" : "Reset to election result") : "Återställ till valnattsprognosen"}</button>
        </div>

        <p className="local-note">{fromOfficial ? (draft ? (sv ? "Eget scenario från valresultatet" : "Custom scenario based on the result") : (sv ? "Fastställt valresultat 2026" : "Final election result 2026")) : draft ? "Eget scenario från valnattsprognosen" : "Följer valnattens prognos"} · {time}</p>
        <div className="scenario-total" data-invalid={remainingShare < 0 ? "true" : "false"}>
          <div><span>Modeled parties</span><strong>{modeledTotal.toFixed(2)}%</strong></div>
          <div><span>Other parties · residual</span><strong>{Math.max(0, remainingShare).toFixed(2)}%</strong></div>
          <p>{remainingShare >= 0 ? "Other is an unallocated residual, not one combined party." : `${Math.abs(remainingShare).toFixed(2)} percentage points must be removed before seats can be calculated.`}</p>
        </div>

        <div className="party-share-controls">
          {SIMULATOR_PARTY_IDS.map((partyId) => {
            const party = PARTIES[partyId];
            const inputId = `scenario-${partyId.toLowerCase()}`;
            return (
              <div className="party-share-control" key={partyId} style={{ "--party-color": party.color } as CSSProperties}>
                <label htmlFor={inputId}>
                  <PartyMark party={party} size="sm" />
                  <strong>{party.name}</strong>
                </label>
                <input
                  aria-label={`${party.name} vote share slider`}
                  disabled={!activeBaseline}
                  type="range"
                  min="0"
                  max="100"
                  step="0.01"
                  value={Number(shares[partyId].toFixed(2))}
                  onChange={(event) => updateShare(partyId, Number(event.target.value))}
                  style={{ "--share-position": `${shares[partyId]}%` } as CSSProperties}
                />
                <div className="share-number">
                  <input
                    id={inputId}
                    aria-label={`${party.name} vote share`}
                    inputMode="decimal"
                    disabled={!activeBaseline}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={Number(shares[partyId].toFixed(2))}
                    onChange={(event) => updateShare(partyId, Number(event.target.value))}
                  />
                  <span>%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="scenario-assumption">
          <span className="classification-badge classification-badge--model">MODEL · v1.2.0</span>
          <p>{fromOfficial ? (sv ? "Utgångsläget återger Valmyndighetens fastställda röster och samtliga 349 mandat. Egna ändringar är modellscenarier från den version du började med; återställ för senaste resultat." : "The baseline reproduces the authority’s final votes and all 349 seats. Your changes are model scenarios based on the version you started with; reset to use the latest result.") : "Utgångsläget är valnattens prognos, inklusive samma valkretsfördelning och mandat. Egna ändringar utgår från den version du började med; återställ för att följa den senaste prognosen igen."}</p>
        </div>
      </section>

      <section className="simulator-output" aria-labelledby="scenario-output-title" aria-live="polite">
        <div className="simulator-panel-heading simulator-panel-heading--output">
          <div>
            <p className="eyebrow">{draft ? "Eget scenario" : official ? (sv ? "Valresultat 2026" : "Election result 2026") : "Valnattens prognos"}</p>
            <h2 id="scenario-output-title">Riksdag scenario</h2>
          </div>
          <span className="classification-badge classification-badge--model">{!draft && official ? "DERIVED" : "MODEL"}</span>
        </div>

        {simulation.error || !result ? (
          <div className="simulator-error" role="status"><strong>Scenario paused</strong><p>{simulation.error}</p></div>
        ) : (
          <>
            <div className="seat-kpis">
              <div><span>Allocated</span><strong>{result.totalSeats}</strong><small>seats</small></div>
              <div><span>Majority</span><strong>{result.majoritySeats}</strong><small>required</small></div>
              <div><span>Qualifying</span><strong>{qualifyingParties}</strong><small>parties</small></div>
            </div>

            <div className="seat-band" aria-label="Seat distribution; majority marker at 175 seats">
              {rankedParties.filter((party) => party.totalSeats > 0).map((allocation) => (
                <span
                  key={allocation.partyId}
                  style={{ width: `${(allocation.totalSeats / result.totalSeats) * 100}%`, background: PARTIES[allocation.partyId].color }}
                  title={`${PARTIES[allocation.partyId].name}: ${allocation.totalSeats} seats`}
                />
              ))}
              <i style={{ left: `${(result.majoritySeats / result.totalSeats) * 100}%` }}><span>175</span></i>
            </div>

            <div className="seat-result-list">
              <div className="seat-result-list__header"><span>Party</span><span>Share</span><span>Threshold</span><span>Seats</span><span>vs 2022</span></div>
              {rankedParties.map((allocation) => {
                const party = PARTIES[allocation.partyId];
                const delta = allocation.totalSeats - baseline.officialSeats2022[allocation.partyId];
                return (
                  <div className="seat-result-row" key={allocation.partyId}>
                    <div><PartyMark party={party} size="sm" /><span><strong>{party.name}</strong><small>{allocation.fixedSeats} fixed + {allocation.adjustmentSeats} adjustment</small></span></div>
                    <b>{shares[allocation.partyId].toFixed(2)}%</b>
                    <span className={`threshold-status threshold-status--${allocation.thresholdStatus}`}>{thresholdLabel(allocation.thresholdStatus)}</span>
                    <strong>{allocation.totalSeats}</strong>
                    <b className={delta > 0 ? "delta delta--up" : delta < 0 ? "delta delta--down" : "delta"}>{delta > 0 ? "+" : ""}{delta}</b>
                  </div>
                );
              })}
            </div>

            {result.tieBreaks.length > 0 && <p className="simulator-tie-note">Exact comparison-figure tie detected. The simulator used stable party order; an official election would use a drawing of lots.</p>}

            <div className="coalition-builder">
              <div className="coalition-builder__heading">
                <div><p className="eyebrow">Coalition arithmetic</p><h3>Build a combination</h3></div>
                <div><strong>{coalitionTotal}</strong><span>/ {result.majoritySeats} seats</span><small>{coalitionTotal >= result.majoritySeats ? "Majority" : `${result.majoritySeats - coalitionTotal} short`}</small></div>
              </div>
              <div className="coalition-picker" aria-label="Select parties for coalition arithmetic">
                {SIMULATOR_PARTY_IDS.map((partyId) => {
                  const selected = coalition.includes(partyId);
                  return (
                    <button
                      type="button"
                      key={partyId}
                      aria-pressed={selected}
                      aria-label={PARTIES[partyId].name}
                      className={selected ? "coalition-party is-selected" : "coalition-party"}
                      onClick={() => toggleCoalition(partyId)}
                      style={{ "--party-color": PARTIES[partyId].color } as CSSProperties}
                    >
                      <PartyMark party={PARTIES[partyId]} size="sm" />
                      <strong>{result.parties.find((party) => party.partyId === partyId)?.totalSeats ?? 0}</strong>
                    </button>
                  );
                })}
              </div>
              <p>No political bloc is predefined. Coalition arithmetic reflects only the parties selected by the user.</p>
            </div>
          </>
        )}
      </section>
    </div>
  )}</Localize>;
}
