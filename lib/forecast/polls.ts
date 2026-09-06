import type { SimulatorPartyId, SimulatorPartyVotes } from "@/lib/simulator/types";
import { isIsoDateStamp, isoDateToEpoch } from "@/lib/dates";
import { FORECAST_PARTY_IDS, type PollObservation } from "./types";
import { correctPollPublicationDates } from "./source-corrections";

const CSV_PARTY_COLUMNS: Record<SimulatorPartyId, number> = {
  M: 2,
  L: 3,
  C: 4,
  KD: 5,
  S: 6,
  V: 7,
  MP: 8,
  SD: 9,
};

const DAY_MS = 86_400_000;
export const APPROXIMATE_FIELDWORK_WEIGHT = 0.85 as const;
export const MAXIMUM_HOUSE_WEIGHT = 0.25 as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  cells.push(value);
  return cells;
}

function nullableNumber(value: string): number | null {
  if (!value || value === "NA") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid numeric poll value ${JSON.stringify(value)}`);
  return parsed;
}

function nullableDate(value: string): string | null {
  if (!value || value === "NA") return null;
  if (!isIsoDateStamp(value)) {
    throw new Error(`Invalid poll date ${JSON.stringify(value)}`);
  }
  return value;
}

export function parsePollCsv(contents: string): PollObservation[] {
  const lines = contents.trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const expected = ["PublYearMonth", "Company", "M", "L", "C", "KD", "S", "V", "MP", "SD", "FI", "Uncertain", "n", "PublDate", "collectPeriodFrom", "collectPeriodTo", "approxPeriod", "house"];
  if (header.join("|") !== expected.join("|")) throw new Error("SwedishPolls CSV schema changed; refusing to ingest");

  return correctPollPublicationDates(lines.slice(1).filter(Boolean).map((line, index) => {
    const cells = parseCsvLine(line);
    if (cells.length !== expected.length) throw new Error(`Malformed poll CSV row ${index + 2}`);
    if (!/^\d{4}-[A-Za-z0-9]{2,3}$/.test(cells[0])) throw new Error(`Invalid publication-period label on poll CSV row ${index + 2}`);
    if (!cells[1].trim() || !cells[17].trim()) throw new Error(`Missing company or house on poll CSV row ${index + 2}`);
    if (!["TRUE", "FALSE", "NA"].includes(cells[16])) throw new Error(`Invalid approximate-fieldwork flag on poll CSV row ${index + 2}`);
    const shares = Object.fromEntries(
      FORECAST_PARTY_IDS.flatMap((partyId) => {
        const value = nullableNumber(cells[CSV_PARTY_COLUMNS[partyId]]);
        return value === null ? [] : [[partyId, value]];
      }),
    ) as Partial<SimulatorPartyVotes>;

    return {
      publishedMonth: cells[0],
      company: cells[1],
      house: cells[17] || cells[1],
      shares,
      uncertain: nullableNumber(cells[11]),
      sampleSize: nullableNumber(cells[12]),
      publishedAt: nullableDate(cells[13]),
      fieldworkFrom: nullableDate(cells[14]),
      fieldworkTo: nullableDate(cells[15]),
      approximateFieldwork: cells[16] === "TRUE",
      rowNumber: index + 2,
    };
  }));
}

export function dateToEpoch(date: string): number {
  return isoDateToEpoch(date);
}

export function daysBetween(earlier: string, later: string): number {
  return Math.round((dateToEpoch(later) - dateToEpoch(earlier)) / DAY_MS);
}

export function subtractDays(date: string, days: number): string {
  return new Date(dateToEpoch(date) - days * DAY_MS).toISOString().slice(0, 10);
}

/** The first date on which a historical model could legally have seen a poll. */
export function availabilityDate(poll: PollObservation): string | null {
  return poll.publishedAt;
}

/** Fieldwork midpoint drives decay; approximate/invalid fieldwork falls back to publication. */
export function measurementDate(poll: PollObservation): string | null {
  const published = availabilityDate(poll);
  if (poll.approximateFieldwork || !poll.fieldworkFrom || !poll.fieldworkTo) return published;
  const from = dateToEpoch(poll.fieldworkFrom);
  const to = dateToEpoch(poll.fieldworkTo);
  if (from > to) return published;
  return new Date(from + Math.floor((to - from) / 2)).toISOString().slice(0, 10);
}

export function hasCompleteModernShares(poll: PollObservation): poll is PollObservation & { shares: SimulatorPartyVotes } {
  return FORECAST_PARTY_IDS.every((partyId) => Number.isFinite(poll.shares[partyId]));
}

export type AverageConfiguration = {
  windowDays: number;
  halfLifeDays: number;
};

export type PollAverage = {
  shares: SimulatorPartyVotes & { OTHER: number };
  pollCount: number;
  houseCount: number;
  interviewCount: number;
  approximatePollCount: number;
  effectivePollCount: number;
  effectiveHouseCount: number;
  maximumRealizedHouseWeight: number;
  disagreements: SimulatorPartyVotes;
  polls: PollObservation[];
  weights: Array<{ rowNumber: number; house: string; weight: number }>;
};

function sampleWeight(sampleSize: number | null): number {
  if (!sampleSize || sampleSize <= 0) return 1;
  return Math.min(2.5, Math.max(0.55, Math.sqrt(sampleSize / 1_500)));
}

function recencyWeight(ageDays: number, halfLifeDays: number): number {
  return Math.exp((-Math.LN2 * Math.max(0, ageDays)) / halfLifeDays);
}

function kishEffectiveCount(weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const squareTotal = weights.reduce((sum, weight) => sum + weight ** 2, 0);
  return squareTotal === 0 ? 0 : (total ** 2) / squareTotal;
}

function capHouseWeights(
  rows: Array<{ poll: PollObservation; weight: number }>,
  maximumHouseWeight: number,
): Array<{ poll: PollObservation; weight: number }> {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.poll.house, (totals.get(row.poll.house) ?? 0) + row.weight);
  const houseTotals = [...totals.values()];
  if (houseTotals.length === 0) return rows;
  const feasibleCap = Math.max(maximumHouseWeight, 1 / houseTotals.length);

  let lower = 0;
  let upper = Math.max(...houseTotals);
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const threshold = (lower + upper) / 2;
    const cappedTotal = houseTotals.reduce((sum, total) => sum + Math.min(total, threshold), 0);
    if (threshold > feasibleCap * cappedTotal) upper = threshold;
    else lower = threshold;
  }
  const threshold = (lower + upper) / 2;
  return rows.map((row) => {
    const total = totals.get(row.poll.house) ?? row.weight;
    return { poll: row.poll, weight: row.weight * Math.min(1, threshold / total) };
  });
}

export function qualifyingPolls(polls: PollObservation[], asOf: string, windowDays: number): PollObservation[] {
  return polls.filter((poll) => {
    const available = availabilityDate(poll);
    const measured = measurementDate(poll);
    if (!available || !measured || !hasCompleteModernShares(poll)) return false;
    if (daysBetween(available, asOf) < 0) return false;
    const age = daysBetween(measured, asOf);
    return age >= 0 && age <= windowDays;
  }).sort((left, right) => left.rowNumber - right.rowNumber);
}

export function calculatePollAverage(polls: PollObservation[], asOf: string, configuration: AverageConfiguration): PollAverage {
  const eligible = qualifyingPolls(polls, asOf, configuration.windowDays);
  if (eligible.length === 0) throw new Error(`No complete polls published before ${asOf}`);

  const rawRows = eligible.map((poll) => {
    const measured = measurementDate(poll);
    if (!measured) throw new Error(`Poll row ${poll.rowNumber} has no usable date`);
    const approximatePenalty = poll.approximateFieldwork ? APPROXIMATE_FIELDWORK_WEIGHT : 1;
    return {
      poll,
      weight: recencyWeight(daysBetween(measured, asOf), configuration.halfLifeDays) * sampleWeight(poll.sampleSize) * approximatePenalty,
    };
  });
  const weightedRows = capHouseWeights(rawRows, MAXIMUM_HOUSE_WEIGHT);
  const totalWeight = weightedRows.reduce((sum, row) => sum + row.weight, 0);
  if (totalWeight <= 0) throw new Error("Polling average has no positive observation weight");

  const rawMeans = {} as Record<SimulatorPartyId | "OTHER", number>;
  const disagreements = {} as SimulatorPartyVotes;
  for (const partyId of [...FORECAST_PARTY_IDS, "OTHER"] as const) {
    const observations = weightedRows.map(({ poll, weight }) => {
      const value = partyId === "OTHER"
        ? Math.max(0, 100 - FORECAST_PARTY_IDS.reduce((sum, id) => sum + (poll.shares[id] ?? 0), 0))
        : poll.shares[partyId]!;
      return { value, weight };
    });
    const value = observations.reduce((sum, observation) => sum + observation.value * observation.weight, 0) / totalWeight;
    rawMeans[partyId] = value;
    if (partyId !== "OTHER") {
      disagreements[partyId] = Math.sqrt(
        observations.reduce((sum, observation) => sum + observation.weight * (observation.value - value) ** 2, 0) / totalWeight,
      );
    }
  }

  const rawTotal = Object.values(rawMeans).reduce((sum, value) => sum + value, 0);
  const shares = Object.fromEntries(
    ([...FORECAST_PARTY_IDS, "OTHER"] as const).map((partyId) => [partyId, (rawMeans[partyId] / rawTotal) * 100]),
  ) as SimulatorPartyVotes & { OTHER: number };
  const normalizedWeights = weightedRows.map((row) => row.weight / totalWeight);
  const normalizedHouseWeights = new Map<string, number>();
  weightedRows.forEach((row, index) => {
    normalizedHouseWeights.set(row.poll.house, (normalizedHouseWeights.get(row.poll.house) ?? 0) + normalizedWeights[index]);
  });

  return {
    shares,
    pollCount: eligible.length,
    houseCount: new Set(eligible.map((poll) => poll.house)).size,
    interviewCount: eligible.reduce((sum, poll) => sum + (poll.sampleSize ?? 0), 0),
    approximatePollCount: eligible.filter((poll) => poll.approximateFieldwork).length,
    effectivePollCount: kishEffectiveCount(normalizedWeights),
    effectiveHouseCount: kishEffectiveCount([...normalizedHouseWeights.values()]),
    maximumRealizedHouseWeight: Math.max(...normalizedHouseWeights.values()),
    disagreements,
    polls: eligible,
    weights: weightedRows.map((row, index) => ({ rowNumber: row.poll.rowNumber, house: row.poll.house, weight: normalizedWeights[index] })),
  };
}
