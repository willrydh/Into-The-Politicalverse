import raw from "@/data/raw/svt-valu-2026/mandat.json";
import sourceIndex from "@/data/raw/svt-valu-2026/source-index.json";
import manifest from "@/data/raw/svt-valu-2026/source-manifest.json";
import type { PartyId } from "./elections/types";

const SOURCE_URL = "https://www.svt.se/special/articledata/5362/mandat.json";
const SOURCE_KEYS = ["s", "m", "sd", "v", "c", "mp", "kd", "l"] as const;

export type SvtValu = {
  classification: "POLL";
  electionDate: "2026-09-13";
  electionType: "RD";
  scope: "SE";
  sampleSize: number;
  retrievedAt: string;
  sourceUrl: string;
  sampleSourceUrl: string;
  parties: { partyId: PartyId; share: number }[];
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid SVT Valu object");
  return value as Record<string, unknown>;
}

function share(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  )
    throw new Error("Invalid SVT Valu percentage");
  return value;
}

/** Reviewed survey snapshot. Never import the widget's simulated votes or seats. */
export function normalizeSvtValu(value: unknown, index: unknown): SvtValu {
  const input = record(value);
  const meta = record(input._meta);
  if (record(index).valu !== SOURCE_URL || manifest.data.url !== SOURCE_URL)
    throw new Error("SVT Valu source identity changed");
  if (
    meta.year !== 2026 ||
    manifest.electionDate !== "2026-09-13" ||
    manifest.classification !== "POLL"
  )
    throw new Error("SVT Valu election identity changed");
  const keys = Object.keys(input).filter((key) => key !== "_meta");
  if (
    keys.length !== SOURCE_KEYS.length ||
    SOURCE_KEYS.some((key) => !keys.includes(key))
  )
    throw new Error("Incomplete SVT Valu party coverage");
  const parties = SOURCE_KEYS.map((key) => ({
    partyId: key.toUpperCase() as PartyId,
    share: share(record(input[key]).procent),
  }));
  parties.push({ partyId: "OTHER", share: share(meta.ovr_utesluten_pct) });
  // Nine independently rounded source percentages permit at most 0.045 pp drift.
  if (
    Math.abs(parties.reduce((sum, party) => sum + party.share, 0) - 100) >
    0.045 + 1e-9
  )
    throw new Error("SVT Valu percentages do not reconcile");
  return {
    classification: "POLL",
    electionDate: "2026-09-13",
    electionType: "RD",
    scope: "SE",
    sampleSize: manifest.sampleSize,
    retrievedAt: manifest.data.retrievedAt,
    sourceUrl: manifest.presentationUrl,
    sampleSourceUrl: manifest.sampleSource.url,
    parties: parties.sort((a, b) => b.share - a.share),
  };
}

export function getSvtValu(): SvtValu {
  return normalizeSvtValu(raw, sourceIndex);
}
