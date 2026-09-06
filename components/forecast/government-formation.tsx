"use client";
import { Localize } from "@/components/localize";
import {
  getConstitutionalClaim,
  getGovernmentPartyContext,
  governmentFormationContext,
  type GovernmentContextSource,
} from "@/lib/forecast/government";
import type { ElectionForecast, ForecastCoalition } from "@/lib/forecast/types";

function pct(value: number): string {
  return `${(value * 100).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function sourceDate(source: GovernmentContextSource): { label: string; value: string } {
  if (source.effectiveAt) return { label: "gäller från", value: source.effectiveAt };
  if (source.publishedAt) return { label: "publicerad", value: source.publishedAt };
  return { label: "kontrollerad", value: source.checkedAt };
}

function requiredCoalition(forecast: ElectionForecast, id: string): ForecastCoalition {
  const coalition = forecast.coalitions.find((candidate) => candidate.id === id);
  if (!coalition) throw new Error(`Forecast is missing coalition ${id}.`);
  return coalition;
}

function statusLabel(status: ForecastCoalition["status"]): string {
  if (status === "declared") return "DEKLARERAT ALTERNATIV";
  if (status === "politically-contested") return "POLITISKT OMSTRITT";
  return "MANDATSCENARIO";
}

export function GovernmentFormation({ forecast, compact = false }: { forecast: ElectionForecast; compact?: boolean }) {
  const opposition = requiredCoalition(forecast, "opposition-four");
  const tido = requiredCoalition(forecast, "tido-four");
  const coalitions = compact ? forecast.coalitions.slice(0, 5) : forecast.coalitions;
  const andersson = getGovernmentPartyContext("S").leaders[0];
  const kristersson = getGovernmentPartyContext("M").leaders[0];
  const parliamentarism = getConstitutionalClaim("negative-parliamentarism");
  const ministers = getConstitutionalClaim("prime-minister-appoints-ministers");

  return <Localize>{(
    <div className="government-product">
      <div className="pm-paths">
        <article className="pm-path pm-path--lead">
          <header><span>MANDATBAS · {andersson.toLocaleUpperCase("sv-SE")}</span><b>MODEL</b></header>
          <p>{opposition.name} når gränsen för egen majoritet i</p>
          <strong>{pct(opposition.majorityProbability)}</strong>
          <small>av modellkörningarna · inte statsministerodds</small>
        </article>
        <article className="pm-path">
          <header><span>MANDATBAS · {kristersson.toLocaleUpperCase("sv-SE")}</span><b>MODEL</b></header>
          <p>{tido.name} når gränsen för egen majoritet i</p>
          <strong>{pct(tido.majorityProbability)}</strong>
          <small>av modellkörningarna · inte statsministerodds</small>
        </article>
        <aside className="government-knot">
          <span>{parliamentarism.classification} · KONTROLLERAT {formatDate(governmentFormationContext.checkedAt).toLocaleUpperCase("sv-SE")}</span>
          <h3>{parliamentarism.headline}</h3>
          <p>{parliamentarism.summary}</p>
          <p>{parliamentarism.consequence}</p>
          <a href={parliamentarism.source.url} target="_blank" rel="noreferrer">
            {parliamentarism.source.publisher}: {parliamentarism.source.title} ↗
          </a>
        </aside>
      </div>

      <div className="coalition-list">
        {coalitions.map((coalition) => (
          <article key={coalition.id}>
            <header><strong>{coalition.name}</strong><span>{statusLabel(coalition.status)}</span></header>
            <div>
              <strong>{coalition.centralSeats}</strong>
              <span>/ 349 mandat i mittscenariot</span>
              <b>{pct(coalition.majorityProbability)} modellfrekvens för minst 175</b>
            </div>
            <p>{coalition.explanation}</p>
            <small>Egen majoritet beskriver mandatmatematik. Regeringsduglighet kräver även att partiernas villkor går att förena eller tolereras.</small>
          </article>
        ))}
      </div>

      {!compact ? (
        <section className="minister-radar">
          <header>
            <div><span className="mini-label">DECLARED · CONTEXT</span><h3>Partiledare och deklarerade regeringslinjer</h3></div>
            <p>Daterade offentliga besked, kontrollerade {formatDate(governmentFormationContext.checkedAt)}. De är källkontext – inte modellodds.</p>
          </header>
          <div className="minister-radar__grid">
            {governmentFormationContext.partyContexts.map((party) => {
              const leaderDate = sourceDate(party.leaderSource);
              return (
                <article className="minister-radar__party" key={party.partyId} id={`leader-${party.partyId}`}>
                  <header>
                    <span>{party.partyId}</span>
                    <div>
                      <strong>{party.leaders.join(" & ")}</strong>
                      <small>{party.leaderTitle}</small>
                    </div>
                    <a href={party.leaderSource.url} target="_blank" rel="noreferrer" title={party.leaderSource.title}>
                      Ledarkälla · <time dateTime={leaderDate.value}>{formatDate(leaderDate.value)}</time> ↗
                    </a>
                  </header>
                  <ul>
                    {party.claims.map((claim) => {
                      const dated = sourceDate(claim.source);
                      return (
                        <li key={claim.id}>
                          <span>{claim.classification}</span>
                          <strong>{claim.headline}</strong>
                          <p>{claim.summary}</p>
                          <small>{claim.consequence}</small>
                          <a href={claim.source.url} target="_blank" rel="noreferrer">
                            {claim.source.publisher} · {dated.label} <time dateTime={dated.value}>{formatDate(dated.value)}</time> ↗
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
          <div className="minister-radar__guardrail">
            <strong>{ministers.headline}</strong>
            <p>{ministers.summary} {ministers.consequence}</p>
            <a href={ministers.source.url} target="_blank" rel="noreferrer">Grundlagskontext hos {ministers.source.publisher} ↗</a>
          </div>
          <p className="minister-radar__method">{governmentFormationContext.methodNote}</p>
        </section>
      ) : null}
    </div>
  )}</Localize>;
}
