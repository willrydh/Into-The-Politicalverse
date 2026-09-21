"use client";

import { useLocale } from "../localize";
import { PartyMark } from "../party-mark";
import { SortHeaders, useTableSort } from "../table-sort";
import { translateText } from "@/lib/i18n/translate";
import { PARTIES } from "@/lib/parties";
import { PARTY_CODE_TO_ID } from "@/lib/live/constants";
import { useState } from "react";
import type { CountedArea } from "@/lib/live/area-types";

export function LiveResultTable({ area, compact = false, mandates = true }: { area: CountedArea; compact?: boolean; mandates?: boolean }) {
  const locale = useLocale(), sv = locale === "sv", language = sv ? "sv-SE" : "en-GB";
  const table = useTableSort(area.parties, [
    { key: "party", label: sv ? "Parti" : "Party", name: sv ? "Parti" : "Party", direction: "ascending", value: p => translateText(PARTIES[PARTY_CODE_TO_ID[p.code]]?.name ?? p.name, locale) },
    { key: "votes", label: sv ? "Röster" : "Votes", name: sv ? "Röster" : "Votes", value: p => p.votes },
    { key: "share", label: sv ? "Andel" : "Share", name: sv ? "Andel" : "Share", value: p => p.share },
    ...(mandates ? [{ key: "seats", label: sv ? "Mandat" : "Seats", name: sv ? "Mandat" : "Seats", value: (p: CountedArea["parties"][number]) => p.seats }] : []),
  ], { key: "votes", direction: "descending" });
  const percent = (n: number | null) => n === null ? "—" : `${n.toLocaleString(language, { maximumFractionDigits: 2 })} %`;
  const delta = (n: number, digits = 2) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString(language, { maximumFractionDigits: digits })}`;
  const comparison = area.previous;
  const localParties = area.parties.filter(p => !PARTIES[PARTY_CODE_TO_ID[p.code]]);
  const context = `${area.code}:${area.validVotes}`;
  const [expandedContext, setExpandedContext] = useState("");
  const expanded = expandedContext === context;
  const rows = expanded ? table.rows : table.rows.slice(0, 12);
  return <><div className={`live-table${compact ? " live-table--compact" : ""}${mandates ? "" : " live-table--votes"}`} role="table" aria-label={mandates ? (sv ? "Räknade röster och officiella mandat" : "Counted votes and official seats") : (sv ? "Räknade röster" : "Counted votes")}>
    <div role="row" className="live-table__head"><SortHeaders control={table} as="span" /></div>
    {rows.map(p => {
      const party = PARTIES[PARTY_CODE_TO_ID[p.code]];
      const previous = comparison?.parties.find(old => old.code === p.code);
      return <div role="row" key={p.code}>
        <span role="cell" className="live-party">{party ? <><PartyMark party={party} size="sm" /><span className="live-party__name">{translateText(party.name, locale)}</span></> : <><span className="live-party__local-name">{p.name}</span><abbr className="live-party__local-short" title={p.name} aria-label={p.name}>{p.abbreviation || p.name}</abbr></>}</span>
        <span role="cell">{p.votes.toLocaleString(language)}{comparison && <small className="live-table__baseline">2022: {previous?.votes == null ? "—" : previous.votes.toLocaleString(language)}</small>}</span>
        <span role="cell">{percent(p.share)}{comparison && <small className="live-table__baseline">{p.share != null && previous?.share != null ? `${delta(p.share - previous.share)} pp` : "—"}</small>}</span>
        {mandates && <span role="cell"><strong>{p.seats ?? "—"}</strong>{comparison && <small className="live-table__baseline" title={`2022: ${previous?.seats ?? "—"}`}>{p.seats != null && previous?.seats != null ? delta(p.seats - previous.seats, 0) : "—"}</small>}</span>}
      </div>;
    })}
    {(area.otherVotes > 0 || (comparison?.otherVotes ?? 0) > 0) && <div role="row"><span role="cell">{sv ? (compact ? "Övriga" : "Övriga rapporterade partier") : (compact ? "Other" : "Other reported parties")}</span><span role="cell">{area.otherVotes.toLocaleString(language)}{comparison?.otherVotes != null && <small className="live-table__baseline">2022: {comparison.otherVotes.toLocaleString(language)}</small>}</span><span role="cell">{percent(area.validVotes > 0 ? area.otherVotes / area.validVotes * 100 : null)}{comparison?.otherVotes != null && comparison.validVotes > 0 && area.validVotes > 0 && <small className="live-table__baseline">{delta((area.otherVotes / area.validVotes - comparison.otherVotes / comparison.validVotes) * 100)} pp</small>}</span>{mandates && <span role="cell">—</span>}</div>}
  </div>{table.rows.length > 12 && <button className="simulator-reset" type="button" aria-expanded={expanded} onClick={() => setExpandedContext(expanded ? "" : context)}>{expanded ? (sv ? "Visa färre partier" : "Show fewer parties") : (sv ? `Visa alla ${table.rows.length} partier` : `Show all ${table.rows.length} parties`)}</button>}
  {area.sourceWarnings?.includes("previous-party-total") && <p className="local-note" role="status">{sv ? "Jämförelsen med 2022 har pausats: källans tidigare partital summerar inte korrekt. Rösterna för 2026 är kontrollerade." : "The 2022 comparison is withheld because the source’s previous party totals do not reconcile. The 2026 votes have been validated."}</p>}
  {area.sourceWarnings?.includes("missing-counted-electorate") && <p className="local-note">{sv ? "Röster från uppsamlingsdistrikt är medräknade. Valdeltagande kan ännu inte beräknas eftersom räknade distrikt saknar egen väljarnämnare." : "Collection-district ballots are included. Turnout cannot yet be calculated because the counted districts have no electorate of their own."}</p>}
  {comparison && <p className="local-note live-comparison-note">{sv ? "2026 visas först. Under rösterna: 2022. Under andel och mandat: förändring mot 2022. pp = procentenheter. Jämförelsen följer Valmyndighetens underlag; pågående räkning kan ändra utfallet. — = jämförelse saknas." : "2026 is shown first. Below votes: 2022. Below share and seats: change from 2022. pp = percentage points. Comparisons use the authority’s baseline; the ongoing count may change the result. — = comparison unavailable."}</p>}{compact && localParties.length > 0 && <details className="local-details live-party-key"><summary>{sv ? "Partibeteckningar" : "Party names"}</summary>{localParties.map(p => <p key={p.code}><strong>{p.abbreviation || p.code}</strong> · {p.name}</p>)}</details>}</>;
}
