"use client";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "../localize";
import { MobileTableSort, SortHeaders, useTableSort } from "../table-sort";
import { localizedHref } from "@/lib/i18n/translate";
import { personHref } from "@/lib/candidates/types";
import type { LeaderboardEntry } from "@/lib/candidates/leaderboards";
import { CandidateParty, partyLabel } from "./shared";
import { CandidateBallotPositions } from "./ballot-positions";

export function RiksdagVoteResults({ entries, year, context }: { entries: LeaderboardEntry[]; year: number; context: string }) {
  const locale = useLocale(), sv = locale === "sv", fmt = (n: number) => n.toLocaleString(sv ? "sv-SE" : "en-GB");
  const [pagination, setPagination] = useState({ context, page: 0 });
  if (pagination.context !== context) setPagination({ context, page: 0 });
  const page = pagination.context === context ? pagination.page : 0;
  const table = useTableSort(entries, [
    { key: "rank", label: "#", name: sv ? "Placering" : "Rank", direction: "ascending", value: e => e.rank },
    { key: "name", label: sv ? "Kandidat" : "Candidate", name: sv ? "Kandidat" : "Candidate", direction: "ascending", value: e => e.row.name },
    { key: "party", label: sv ? "Parti" : "Party", name: sv ? "Parti" : "Party", direction: "ascending", value: e => partyLabel(e.row, sv) },
    { key: "votes", label: `${sv ? "Personröster" : "Personal votes"} ${year}`, name: sv ? "Personröster" : "Personal votes", value: e => e.votes },
  ], { key: "rank", direction: "ascending" }, context);
  const setPage = (page: number) => setPagination({ context, page });
  return <><MobileTableSort control={table} onSort={() => setPage(0)}/><div className="candidate-scoreboard candidate-riksdag-totals"><table><thead><tr><SortHeaders control={table} onSort={() => setPage(0)}/></tr></thead><tbody>{table.rows.slice(page * 50, (page + 1) * 50).map(entry => <tr key={`${entry.row.person}:${entry.row.partyCode}`}>
    <td className="candidate-rank">{entry.rank}</td>
    <th scope="row"><div className="riksdag-candidate-name"><Link href={localizedHref(`${personHref(entry.row.person, "RD", entry.row.areaCode)}&year=${year}`, locale)}>{entry.row.name}</Link><span className="riksdag-mobile-party"><CandidateParty result={entry.row}/></span></div>
      <details className="riksdag-constituencies"><summary>{entry.members.length} {sv ? (entry.members.length === 1 ? "valkrets" : "valkretsar") : (entry.members.length === 1 ? "constituency" : "constituencies")}</summary><ul>{entry.members.map(r => <li key={r.areaCode}><div><Link href={localizedHref(`${personHref(r.person, "RD", r.areaCode)}&year=${year}`, locale)}>{r.areaName}</Link><b>{fmt(r.votes)}</b></div><CandidateBallotPositions ballots={r.ballotPositions} year={year}/></li>)}</ul></details>
    </th>
    <td className="riksdag-desktop-party"><CandidateParty result={entry.row}/></td>
    <td className="candidate-total"><strong>{fmt(entry.votes)}</strong><small>{year}</small></td>
  </tr>)}</tbody></table></div>
    {!entries.length && <p className="candidate-empty">{sv ? "Inga resultat i det här urvalet." : "No results for this selection."}</p>}
    {entries.length > 50 && <nav className="candidate-pagination" aria-label={sv ? "Topplistans sidor" : "Leaderboard pages"}><button className="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{sv ? "Föregående" : "Previous"}</button><span>{page + 1} / {Math.ceil(entries.length / 50)}</span><button className="button" disabled={(page + 1) * 50 >= entries.length} onClick={() => setPage(page + 1)}>{sv ? "Nästa" : "Next"}</button></nav>}
  </>;
}
