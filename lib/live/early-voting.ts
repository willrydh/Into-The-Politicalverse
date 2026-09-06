import { isIsoDateStamp } from "../dates";
import type { EarlyVoting } from "./types";
import { insist } from "./validation";

export const EARLY_VOTING_URL = "https://data.val.se/filer/val2026/rostmottagning/mottagna-fortidsroster-val2026.csv";

export function parseSemicolonCsv(raw: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const input = raw.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') { if (quoted && input[i + 1] === '"') { cell += '"'; i++; } else { insist(quoted || cell === "", "Unexpected CSV quote"); quoted = !quoted; } }
    else if (char === ";" && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && input[i + 1] === "\n") i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += char;
  }
  insist(!quoted, "Unclosed CSV quote");
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  insist(rows.length >= 2 && rows.every(row => row.length === rows[0].length), "CSV row width changed");
  return rows;
}

export function normalizeEarlyVoting(raw: string, metadata: { retrievedAt: string; rawSha256: string }): EarlyVoting {
  const [header, ...rows] = parseSemicolonCsv(raw);
  insist(header.slice(0, 6).join("|") === "LÄNSKOD|LÄN|KOMMUNKOD|KOMMUN|LOKALID|LOKAL" && header.at(-1) === "TOTAL", "Early-voting CSV schema changed");
  const dates = header.slice(6, -1);
  insist(dates.length > 0 && dates.every((date, i) => isIsoDateStamp(date) && date >= "2026-08-26" && date <= "2026-09-13" && (i === 0 || date > dates[i - 1])), "Unexpected early-voting date columns");
  const count = (text: string) => { insist(/^\d+$/.test(text) && Number.isSafeInteger(Number(text)), "Invalid early-voting count"); return Number(text); };
  const summary = rows.filter(row => row[5] === "SUMMA" && row[4] === "");
  insist(summary.length === 1, "Expected exactly one official SUMMA row");
  const locations = rows.filter(row => row !== summary[0]);
  const seen = new Set<string>(); const totals = dates.map(() => 0);
  const municipalities = new Map<string, { code: string; name: string; votes: number }>();
  for (const row of locations) {
    insist(/^\d{2}$/.test(row[0]) && /^\d{2}$/.test(row[2]) && /^\d{7}$/.test(row[4]), "Unexpected municipality or location code");
    insist(!seen.has(row[4]), "Duplicate early-voting location"); seen.add(row[4]);
    const code = row[0] + row[2]; insist(row[4].startsWith(code), "Early-voting location does not match municipality");
    const daily = row.slice(6, -1).map(count); const total = count(row.at(-1)!);
    insist(daily.reduce((a, b) => a + b, 0) === total, "Early-voting row total mismatch");
    daily.forEach((value, i) => { insist(dates[i] <= metadata.retrievedAt.slice(0, 10) || value === 0, "Nonzero votes on a future date"); totals[i] += value; });
    const municipality = municipalities.get(code) ?? { code, name: row[3], votes: 0 };
    insist(municipality.name === row[3], "Inconsistent municipality name"); municipality.votes += total; municipalities.set(code, municipality);
  }
  const reported = summary[0].slice(6, -1).map(count);
  insist(totals.every((value, i) => value === reported[i]), "Location sums differ from official daily SUMMA");
  const receivedVotes = totals.reduce((a, b) => a + b, 0);
  insist(receivedVotes === count(summary[0].at(-1)!), "Official grand total mismatch");
  return { classification: "OFFICIAL", ...metadata, sourceUrl: EARLY_VOTING_URL, lastNonzeroDate: dates.filter((_, i) => totals[i] > 0).at(-1) ?? null, receivedVotes, locations: locations.length, daily: dates.map((date, i) => ({ date, votes: totals[i] })), municipalities: [...municipalities.values()].sort((a, b) => a.code.localeCompare(b.code)) };
}
