"use client";
import { Localize } from "@/components/localize";


import { useMemo, useState, type CSSProperties } from "react";
import { PartyMark } from "@/components/party-mark";
import { PARTIES } from "@/lib/parties";
import { coalitionSeats } from "@/lib/simulator/riksdag-rules";
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
  const [shares, setShares] = useState<SimulatorPartyVotes>(() => ({ ...baseline.shares }));
  const [coalition, setCoalition] = useState<SimulatorPartyId[]>([]);
  const modeledTotal = shareTotal(shares);
  const remainingShare = 100 - modeledTotal;
  const simulation = useMemo(() => {
    try {
      return { output: simulateRiksdagScenario(baseline, shares), error: null };
    } catch (error) {
      return { output: null, error: error instanceof Error ? error.message : "The scenario could not be calculated" };
    }
  }, [baseline, shares]);

  const result = simulation.output?.result ?? null;
  const rankedParties = result ? [...result.parties].sort((left, right) => right.totalSeats - left.totalSeats || SIMULATOR_PARTY_IDS.indexOf(left.partyId) - SIMULATOR_PARTY_IDS.indexOf(right.partyId)) : [];
  const coalitionTotal = result ? coalitionSeats(result, coalition) : 0;
  const qualifyingParties = result?.parties.filter((party) => party.thresholdStatus !== "below").length ?? 0;

  function updateShare(partyId: SimulatorPartyId, value: number): void {
    const next = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value * 100) / 100)) : 0;
    setShares((current) => ({ ...current, [partyId]: next }));
  }

  function toggleCoalition(partyId: SimulatorPartyId): void {
    setCoalition((current) => current.includes(partyId) ? current.filter((candidate) => candidate !== partyId) : [...current, partyId]);
  }

  return <Localize>{(
    <div className="simulator-shell">
      <section className="simulator-inputs" aria-labelledby="scenario-input-title">
        <div className="simulator-panel-heading">
          <div>
            <p className="eyebrow">Scenario input</p>
            <h2 id="scenario-input-title">Set national vote share</h2>
          </div>
          <button className="simulator-reset" type="button" onClick={() => setShares({ ...baseline.shares })}>Reset to 2022</button>
        </div>

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
                  <span><strong>{party.name}</strong><small>{party.shortName}</small></span>
                </label>
                <input
                  aria-label={`${party.name} vote share slider`}
                  type="range"
                  min="0"
                  max="100"
                  step="0.01"
                  value={shares[partyId]}
                  onChange={(event) => updateShare(partyId, Number(event.target.value))}
                  style={{ "--share-position": `${shares[partyId]}%` } as CSSProperties}
                />
                <div className="share-number">
                  <input
                    id={inputId}
                    aria-label={`${party.name} vote share`}
                    inputMode="decimal"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={shares[partyId]}
                    onChange={(event) => updateShare(partyId, Number(event.target.value))}
                  />
                  <span>%</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="scenario-assumption">
          <span className="classification-badge classification-badge--model">MODEL · v1.0.0</span>
          <p>Initial shares reproduce the official 2022 national percentages. National shares are distributed using each party&apos;s official 2022 constituency pattern, then calculated with the official 2026 fixed-seat allocation.</p>
        </div>
      </section>

      <section className="simulator-output" aria-labelledby="scenario-output-title" aria-live="polite">
        <div className="simulator-panel-heading simulator-panel-heading--output">
          <div>
            <p className="eyebrow">Deterministic result</p>
            <h2 id="scenario-output-title">Riksdag scenario</h2>
          </div>
          <span className="classification-badge classification-badge--model">MODEL</span>
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
                      className={selected ? "coalition-party is-selected" : "coalition-party"}
                      onClick={() => toggleCoalition(partyId)}
                      style={{ "--party-color": PARTIES[partyId].color } as CSSProperties}
                    >
                      <PartyMark party={PARTIES[partyId]} size="sm" />
                      <span>{partyId}</span>
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
