"use client";
import { majorityLabel } from "@/lib/nowcast/current";
import { PartyMark } from "@/components/party-mark";
import { PartyText } from "@/components/party-label";
import { PARTIES } from "@/lib/parties";
import { Localize } from "@/components/localize";
import {
  getConstitutionalClaim,
  getGovernmentPartyContext,
  governmentFormationContext,
  type GovernmentContextSource,
} from "@/lib/forecast/government";
import type { ElectionForecast, ForecastCoalition } from "@/lib/forecast/types";

export type CoalitionView = Omit<ForecastCoalition, "centralSeats" | "majorityProbability"> & { centralSeats: number | null; majorityProbability: number | null };

function pct(value: number | null, live = false): string {
  if (value === null) return "—";
  if (live) return majorityLabel(value, 1, "sv-SE");
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

function requiredCoalition(coalitions: CoalitionView[], id: string): CoalitionView {
  const coalition = coalitions.find((candidate) => candidate.id === id);
  if (!coalition) throw new Error(`Forecast is missing coalition ${id}.`);
  return coalition;
}

function statusLabel(status: ForecastCoalition["status"]): string {
  if (status === "declared") return "DEKLARERAT ALTERNATIV";
  if (status === "politically-contested") return "POLITISKT OMSTRITT";
  return "MANDATSCENARIO";
}

export function GovernmentFormation({ forecast, current, established = false, compact = false, idPrefix = "" }: { forecast?: ElectionForecast; current?: CoalitionView[]; established?: boolean; compact?: boolean; idPrefix?: string }) {
  const all = current ?? forecast!.coalitions;
  const opposition = requiredCoalition(all, "opposition-four");
  const tido = requiredCoalition(all, "tido-four");
  const coalitions = compact ? all.slice(0, 5) : all;
  const andersson = getGovernmentPartyContext("S").leaders[0];
  const kristersson = getGovernmentPartyContext("M").leaders[0];
  const parliamentarism = getConstitutionalClaim("negative-parliamentarism");
  const ministers = getConstitutionalClaim("prime-minister-appoints-ministers");

  return <Localize>{(
    <div className="government-product">
      <div className="pm-paths">
        <article className="pm-path pm-path--lead">
          <header><span>MANDATBAS · {andersson.toLocaleUpperCase("sv-SE")}</span><b>{established ? "DERIVED" : "MODEL"}</b></header>
          <p><PartyText>{opposition.name}</PartyText>{!established && " når gränsen för egen majoritet i"}</p>
          <strong>{established ? opposition.centralSeats : pct(opposition.majorityProbability, !!current)}</strong>
          <small>{established ? "mandat i det fastställda resultatet · majoritet kräver 175" : current ? "Valnattens simuleringar · träffsäkerheten är inte belagd" : "av modellkörningarna · inte statsministerodds"}</small>
        </article>
        <article className="pm-path">
          <header><span>MANDATBAS · {kristersson.toLocaleUpperCase("sv-SE")}</span><b>{established ? "DERIVED" : "MODEL"}</b></header>
          <p><PartyText>{tido.name}</PartyText>{!established && " når gränsen för egen majoritet i"}</p>
          <strong>{established ? tido.centralSeats : pct(tido.majorityProbability, !!current)}</strong>
          <small>{established ? "mandat i det fastställda resultatet · majoritet kräver 175" : current ? "Valnattens simuleringar · träffsäkerheten är inte belagd" : "av modellkörningarna · inte statsministerodds"}</small>
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
            <header><strong><PartyText>{coalition.name}</PartyText></strong><span>{statusLabel(coalition.status)}</span></header>
            <div>
              <strong>{coalition.centralSeats ?? "—"}</strong>
              <span>{established ? "/ 349 mandat i valresultatet" : "/ 349 mandat i mittscenariot"}</span>
              {coalition.majorityProbability !== null && <b>{pct(coalition.majorityProbability, !!current)} modellfrekvens för minst 175</b>}
            </div>
            <p><PartyText>{coalition.explanation}</PartyText></p>
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
                <article className="minister-radar__party" key={party.partyId} id={`${idPrefix}leader-${party.partyId}`}>
                  <header>
                    <PartyMark party={PARTIES[party.partyId]}/>
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
                          <strong><PartyText>{claim.headline}</PartyText></strong>
                          <p><PartyText>{claim.summary}</PartyText></p>
                          <small><PartyText>{claim.consequence}</PartyText></small>
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
