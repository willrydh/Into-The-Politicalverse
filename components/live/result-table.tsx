"use client";

import { Localize, useLocale } from "../localize";
import { PartyMark } from "../party-mark";
import { SortHeaders, useTableSort } from "../table-sort";
import { translateText } from "@/lib/i18n/translate";
import { PARTIES } from "@/lib/parties";
import { PARTY_CODE_TO_ID } from "@/lib/live/constants";
import type { LiveArea } from "@/lib/live/types";

export function LiveResultTable({ area, compact = false }: { area: LiveArea; compact?: boolean }) {
  const locale = useLocale(), sv = locale === "sv", language = sv ? "sv-SE" : "en-GB";
  const table = useTableSort(area.parties, [
    { key: "party", label: sv ? "Parti" : "Party", name: sv ? "Parti" : "Party", direction: "ascending", value: p => translateText(PARTIES[PARTY_CODE_TO_ID[p.code]]?.name ?? p.name, locale) },
    { key: "votes", label: sv ? "Röster" : "Votes", name: sv ? "Röster" : "Votes", value: p => p.votes },
    { key: "share", label: sv ? "Andel" : "Share", name: sv ? "Andel" : "Share", value: p => p.share },
    { key: "seats", label: sv ? "Mandat" : "Seats", name: sv ? "Mandat" : "Seats", value: p => p.seats },
  ], { key: "votes", direction: "descending" });
  const percent = (n: number | null) => n === null ? "—" : `${n.toLocaleString(language, { maximumFractionDigits: 2 })} %`;
  return <Localize><div className={`live-table${compact ? " live-table--compact" : ""}`} role="table" aria-label="Räknade röster och officiella mandat">
    <div role="row" className="live-table__head"><SortHeaders control={table} as="span" /></div>
    {table.rows.map(p => {
      const party = PARTIES[PARTY_CODE_TO_ID[p.code]];
      return <div role="row" key={p.code}>
        <span role="cell" className="live-party">{party && <PartyMark party={party} size="sm" />}<span className={party ? "live-party__name" : undefined}>{party?.name ?? p.name}</span></span>
        <span role="cell">{p.votes.toLocaleString(language)}</span>
        <span role="cell">{percent(p.share)}</span><strong role="cell">{p.seats ?? "—"}</strong>
      </div>;
    })}
    <div role="row"><span role="cell">{compact ? "Övriga" : "Övriga rapporterade partier"}</span><span role="cell">{area.otherVotes.toLocaleString(language)}</span><span role="cell">{percent(area.validVotes > 0 ? area.otherVotes / area.validVotes * 100 : null)}</span><span role="cell">—</span></div>
  </div></Localize>;
}
