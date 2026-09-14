"use client";
import { Localize, useLocale } from "@/components/localize";
import { useLiveFeed } from "./live/use-live-feed";
import { useAreaFeed } from "./live/use-area-feed";
import { headlineResult, isEstablishedResult } from "@/lib/live/headline-result";
import { selectAreaResult } from "@/lib/live/area-types";
import { PARTY_CODE_TO_ID } from "@/lib/live/constants";


import { type CSSProperties } from "react";
import { navigateLocalQuery, useLocalQuery } from "./maps/local-url";
import { PartyMark } from "@/components/party-mark";
import { PARTIES } from "@/lib/data/elections/parties";
import type { PartyProfile } from "@/lib/data/elections";
import type { PartyId } from "@/lib/data/elections/types";

function PartyShareChange({ value }: { value: number | null }) {
  const sv = useLocale() === "sv";
  return <span className={value !== null && value >= 0 ? "delta delta--up" : "delta delta--down"}>{value === null ? "—" : `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString(sv ? "sv-SE" : "en-GB", { maximumFractionDigits: 2 })}`} <abbr title={sv ? "Procentenheter jämfört med 2022" : "Percentage points compared with 2022"}>pp</abbr></span>;
}

export function PartyExplorer({ profiles }: { profiles: PartyProfile[] }) {
  const sv = useLocale() === "sv", language = sv ? "sv-SE" : "en-GB";
  const live = useLiveFeed(), local = useAreaFeed(), result = headlineResult(live.feed);
  const localResult = local.feed ? selectAreaResult(local.feed, "RD", "00") : null;
  const f = (n: number | null | undefined, digits = 2) => n == null ? "—" : n.toLocaleString(language, { maximumFractionDigits: digits });
  const query = useLocalQuery();
  const requested = new URLSearchParams(query).get("party") as PartyId;
  const selected = profiles.some(p => p.partyId === requested) ? requested : "S";
  const profile = profiles.find((item) => item.partyId === selected) ?? profiles[0];
  const party = PARTIES[profile.partyId];
  const current = result?.national.parties.find(p => PARTY_CODE_TO_ID[p.code] === selected);
  const previous = result?.national.previous?.parties.find(p => PARTY_CODE_TO_ID[p.code] === selected);
  const change = current?.share != null && previous?.share != null ? current.share - previous.share : null;
  const history = current?.share != null ? [...profile.history, { year: 2026, share: current.share }] : profile.history;
  const maxShare = Math.max(...history.map((point) => point.share));
  const municipal = localResult?.municipalities.filter(a => a.validVotes > 0).map(a => ({ name: a.name, code: a.code, share: a.parties.find(p => PARTY_CODE_TO_ID[p.code] === selected)?.share ?? null })).filter((a): a is { name: string; code: string; share: number } => a.share !== null).sort((a, b) => b.share - a.share || a.code.localeCompare(b.code)) ?? [];

  return <Localize>{(
    <div className="party-explorer" id="party-profile">
      <div className="party-explorer__rail" aria-label="Choose party">
        {profiles.map((item) => {
          const itemParty = PARTIES[item.partyId];
          return (
            <button
              key={item.partyId}
              className={item.partyId === selected ? "party-choice is-active" : "party-choice"}
              onClick={() => navigateLocalQuery(`?party=${item.partyId}`)}
              type="button"
              aria-pressed={item.partyId === selected}
            >
              <PartyMark party={itemParty} size="md" />
              <strong>{itemParty.name}</strong>
              <b>{f(result?.national.parties.find(p => PARTY_CODE_TO_ID[p.code] === item.partyId)?.share)}%</b>
            </button>
          );
        })}
      </div>
      <div className="party-explorer__detail" style={{ "--party-color": party.color } as CSSProperties}>
        <div className="party-detail__header">
          <PartyMark party={party} size="lg" />
          <div><span className="mini-label">2026 · {sv ? "Riksdagen" : "Riksdag"}</span><h2>{party.name}</h2></div>
          <div className="party-detail__headline"><strong>{f(current?.share)}%</strong><PartyShareChange value={change} /></div>
        </div>
        <p className="local-note">{result && isEstablishedResult(result) ? (sv ? "Fastställt resultat" : "Final result") : (sv ? "Preliminärt resultat · jämförelse mot 2022" : "Preliminary result · compared with 2022")}{live.clock !== null && (live.delayed || (result && live.feed.stageStatus[result.stage] === "error")) ? ` · ${sv ? "Uppdatering fördröjd" : "Update delayed"}` : ""}.</p>
        <div className="party-history-bars" style={{ gridTemplateColumns: `repeat(${history.length}, minmax(0, 1fr))` }} aria-label={`${party.name} national vote share by election`}>
          {history.map((point) => (
            <div className="party-history-bar" key={point.year}>
              <span>{point.year}</span>
              <div><i style={{ height: `${Math.max(4, (point.share / maxShare) * 100)}%`, background: party.color }} /></div>
              <strong>{point.share.toFixed(2)}</strong>
            </div>
          ))}
        </div>
        {municipal.length === 0 && <p role="status" className="local-note">{local.connectionError ? (sv ? "Kommunresultaten kunde inte hämtas." : "Municipal results could not be loaded.") : (sv ? "Hämtar kommunernas rapporterade röster…" : "Loading reported municipal votes…")}{local.connectionError && <button type="button" onClick={() => void local.retry()}>{sv ? "Försök igen" : "Retry"}</button>}</p>}
        <div className="party-geography">
          <div>
            <span className="mini-label">{sv ? "Starkaste kommunerna · 2026" : "Strongest municipalities · 2026"}</span>
            {municipal.slice(0, 4).map((area, index) => <p key={area.code}><span>{index + 1}</span><strong><a href={`${sv ? "" : "/en"}/maps/?year=2026&election=RD&municipality=${area.code}`}>{area.name}</a></strong><b>{f(area.share)}%</b></p>)}
          </div>
          <div>
            <span className="mini-label">{sv ? "Lägsta röstandelen · 2026" : "Lowest vote share · 2026"}</span>
            {[...municipal].reverse().slice(0, 4).map((area, index) => <p key={area.code}><span>{index + 1}</span><strong><a href={`${sv ? "" : "/en"}/maps/?year=2026&election=RD&municipality=${area.code}`}>{area.name}</a></strong><b>{f(area.share)}%</b></p>)}
          </div>
        </div>
        <div className="party-detail__footer"><span>{f(current?.votes, 0)} {sv ? "röster" : "votes"}</span><span>{current?.seats ?? "—"} {sv ? "mandat" : "seats"}</span><span>{result ? `${result.national.countedDistricts}/${result.national.totalDistricts}` : "—"} {sv ? "rapporterade distrikt" : "reported districts"}</span></div>
        <p className="local-note">{sv ? "Historiska staplar är fastställda val. År 2026 visar räkningen hittills. Kommunlistorna bygger på rapporterade röster och kan ändras." : "Historical bars are final elections. 2026 shows counting so far. Municipal lists use reported votes and may change."} {(local.delayed || local.feed?.failures.includes("index") || (localResult && local.feed?.failures.includes(`${localResult.stage}/RD/00`))) && (sv ? "Kommunuppdateringen är fördröjd." : "Municipal updates are delayed.")}</p>
      </div>
    </div>
  )}</Localize>;
}
