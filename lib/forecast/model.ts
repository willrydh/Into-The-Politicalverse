import { getPartyResult } from "@/lib/data/elections";
import type { HistoricalElection } from "@/lib/data/elections/types";
import { getSimulatorBaseline, type SimulatorBaseline } from "@/lib/simulator/data";
import { coalitionSeats } from "@/lib/simulator/riksdag-rules";
import { simulateRiksdagScenario } from "@/lib/simulator/scenario";
import type { SimulatorPartyId, SimulatorPartySeats, SimulatorPartyVotes } from "@/lib/simulator/types";
import {
  APPROXIMATE_FIELDWORK_WEIGHT,
  MAXIMUM_HOUSE_WEIGHT,
  availabilityDate,
  calculatePollAverage,
  dateToEpoch,
  daysBetween,
  hasCompleteModernShares,
  qualifyingPolls,
  subtractDays,
  type AverageConfiguration,
  type PollAverage,
} from "./polls";
import { FORECAST_PARTY_IDS, type ElectionForecast, type ForecastBacktestElection, type PollObservation } from "./types";

export const FORECAST_ELECTION_DATE = "2026-09-13" as const;
const MODEL_VERSION = "1.0.0-beta.1" as const;
const AVERAGING_VERSION = "pv-poll-average-1.0.0" as const;
const FROZEN_CONFIGURATION = { windowDays: 180, halfLifeDays: 28 } as const satisfies AverageConfiguration;
const CALIBRATION_YEARS = new Set([2010, 2014, 2018]);
const HOLDOUT_YEAR = 2022;
const CATEGORIES = [...FORECAST_PARTY_IDS, "OTHER"] as const;
type ForecastCategory = (typeof CATEGORIES)[number];
type CategoryValues = Record<ForecastCategory, number>;

const OPPOSITION: SimulatorPartyId[] = ["S", "V", "MP", "C"];
const TIDO: SimulatorPartyId[] = ["M", "KD", "L", "SD"];

type HistoricalForecast = {
  election: HistoricalElection;
  cutoff: string;
  average: PollAverage;
  actual: CategoryValues;
  errors: CategoryValues;
  meanAbsoluteError: number;
};

type SourceMetadata = ElectionForecast["source"];

export type GenerateForecastOptions = {
  polls: PollObservation[];
  history: HistoricalElection[];
  source: SourceMetadata;
  dataCutoff: string;
  generatedAt: string;
  simulations?: number;
  seed?: number;
  baseline?: SimulatorBaseline;
};

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function mean(values: number[]): number {
  if (values.length === 0) throw new Error("Cannot calculate a mean from no values");
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rmse(values: number[]): number {
  return Math.sqrt(mean(values.map((value) => value ** 2)));
}

function quantile(values: number[], probability: number): number {
  if (values.length === 0) throw new Error("Cannot calculate a quantile from an empty collection");
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sorted[lower + 1] === undefined ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function actualShares(election: HistoricalElection): CategoryValues {
  return Object.fromEntries(
    CATEGORIES.map((partyId) => [partyId, getPartyResult(election, partyId).share]),
  ) as CategoryValues;
}

function historicalForecasts(
  polls: PollObservation[],
  history: HistoricalElection[],
  horizonDays: number,
  configuration: AverageConfiguration,
): HistoricalForecast[] {
  const modernHistory = history.filter((election) => election.year >= 2010 && election.year <= HOLDOUT_YEAR);
  if (modernHistory.map(({ year }) => year).join(",") !== "2010,2014,2018,2022") {
    throw new Error("Forecast validation requires official elections 2010, 2014, 2018 and 2022");
  }
  return modernHistory.map((election) => {
    const cutoff = subtractDays(election.electionDate, horizonDays);
    const average = calculatePollAverage(polls, cutoff, configuration);
    const actual = actualShares(election);
    const errors = Object.fromEntries(
      CATEGORIES.map((partyId) => [partyId, actual[partyId] - average.shares[partyId]]),
    ) as CategoryValues;
    return {
      election,
      cutoff,
      average,
      actual,
      errors,
      meanAbsoluteError: mean(FORECAST_PARTY_IDS.map((partyId) => Math.abs(errors[partyId]))),
    };
  });
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function standardNormal(random: () => number): number {
  const first = Math.max(Number.EPSILON, random());
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function covarianceMatrix(forecasts: HistoricalForecast[], current: PollAverage): number[][] {
  const categoryMeans = Object.fromEntries(
    CATEGORIES.map((category) => [category, mean(forecasts.map((forecast) => forecast.errors[category]))]),
  ) as CategoryValues;
  const shrinkage = 0.65;
  return CATEGORIES.map((left, leftIndex) => CATEGORIES.map((right, rightIndex) => {
    const sampleCovariance = forecasts.reduce(
      (sum, forecast) => sum + (forecast.errors[left] - categoryMeans[left]) * (forecast.errors[right] - categoryMeans[right]),
      0,
    ) / Math.max(1, forecasts.length - 1);
    if (leftIndex !== rightIndex) return sampleCovariance * (1 - shrinkage);
    const samplingError = left === "OTHER"
      ? 0.2
      : Math.max(0.08, current.disagreements[left] / Math.sqrt(Math.max(1, current.effectivePollCount)));
    return Math.max(0.55 ** 2, sampleCovariance) + samplingError ** 2;
  }));
}

function cholesky(matrix: number[][]): number[][] {
  const size = matrix.length;
  const lower = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      let value = matrix[row][column];
      for (let index = 0; index < column; index += 1) value -= lower[row][index] * lower[column][index];
      if (row === column) lower[row][column] = Math.sqrt(Math.max(value, 1e-8));
      else lower[row][column] = value / lower[column][column];
    }
  }
  return lower;
}

function matrixVectorProduct(lower: number[][], vector: number[]): number[] {
  return lower.map((row, rowIndex) => row.slice(0, rowIndex + 1).reduce((sum, value, columnIndex) => sum + value * vector[columnIndex], 0));
}

function normalizeShares(values: CategoryValues): SimulatorPartyVotes & { OTHER: number } {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(CATEGORIES.map((partyId) => [partyId, (values[partyId] / total) * 100])) as SimulatorPartyVotes & { OTHER: number };
}

function seatsRecord(result: ReturnType<typeof simulateRiksdagScenario>["result"]): SimulatorPartySeats {
  return Object.fromEntries(result.parties.map((party) => [party.partyId, party.totalSeats])) as SimulatorPartySeats;
}

function seatHistogram(values: number[]): Array<{ seats: number; probability: number }> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([seats, count]) => ({ seats, probability: round(count / values.length, 4) }));
}

function trendPoints(
  polls: PollObservation[],
  baseline: SimulatorBaseline,
  dataCutoff: string,
  configuration: AverageConfiguration,
  seed: number,
): ElectionForecast["trend"] {
  const start = subtractDays(dataCutoff, 140);
  const dates = [...new Set(polls.flatMap((poll) => {
    const date = availabilityDate(poll);
    return date && date >= start && date <= dataCutoff && hasCompleteModernShares(poll) ? [date] : [];
  }))].sort();
  const step = Math.max(1, Math.floor(dates.length / 18));
  const sampled = dates.filter((_, index) => index >= dates.length - 2 || index % step === 0);
  return sampled.map((date) => {
    const average = calculatePollAverage(polls, date, configuration);
    const trendSeed = simulationTieSeed(seed, daysBetween("1970-01-01", date));
    const result = simulateRiksdagScenario(baseline, average.shares, { tieSeed: trendSeed }).result;
    return {
      date,
      oppositionSeats: coalitionSeats(result, OPPOSITION),
      tidoSeats: coalitionSeats(result, TIDO),
      partyShares: Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, round(average.shares[partyId], 2)])) as SimulatorPartyVotes,
    };
  });
}

function leaveOneElectionOutIntervalDiagnostics(forecasts: HistoricalForecast[]): { coverage: number; scale: number } {
  const standardizedErrors = forecasts.flatMap((heldOut) => {
    const training = forecasts.filter((forecast) => forecast.election.year !== heldOut.election.year);
    return FORECAST_PARTY_IDS.map((partyId) => {
      const trainingErrors = training.map((forecast) => forecast.errors[partyId]);
      const expectedError = mean(trainingErrors);
      const sigma = Math.max(0.55, rmse(trainingErrors.map((error) => error - expectedError)));
      return Math.abs(heldOut.errors[partyId] - expectedError) / sigma;
    });
  });
  const scale = Math.max(1, quantile(standardizedErrors, 0.8) / 1.2816);
  const coverage = mean(standardizedErrors.map((error) => error <= 1.2816 * scale ? 1 : 0));
  return { coverage, scale };
}

function snapshotId(source: SourceMetadata, dataCutoff: string, seed: number): string {
  const value = `${source.rawSha256}|${source.upstreamCommit}|${MODEL_VERSION}|${dataCutoff}|${seed}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `pvf-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function simulationTieSeed(seed: number, simulation: number): number {
  let value = (seed ^ Math.imul(simulation + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  return value >>> 0;
}

export function generateElectionForecast(options: GenerateForecastOptions): ElectionForecast {
  const baseline = options.baseline ?? getSimulatorBaseline();
  const simulations = options.simulations ?? 10_000;
  if (!Number.isInteger(simulations) || simulations < 2 || simulations % 2 !== 0) throw new Error("Forecast simulations must be a positive even integer");
  const seed = options.seed ?? 2_026_091_3;
  const horizonDays = daysBetween(options.dataCutoff, FORECAST_ELECTION_DATE);
  if (horizonDays < 0) {
    throw new Error(`Forecast cutoff ${options.dataCutoff} is after election day ${FORECAST_ELECTION_DATE}`);
  }
  const forecasts = historicalForecasts(options.polls, options.history, horizonDays, FROZEN_CONFIGURATION);
  const calibration = forecasts.filter((forecast) => CALIBRATION_YEARS.has(forecast.election.year));
  const holdout = forecasts.find((forecast) => forecast.election.year === HOLDOUT_YEAR);
  if (calibration.length !== 3 || !holdout) throw new Error("The fixed forecast requires three calibration elections and the 2022 holdout");

  const current = calculatePollAverage(options.polls, options.dataCutoff, FROZEN_CONFIGURATION);
  const centralResult = simulateRiksdagScenario(baseline, current.shares, { tieSeed: seed }).result;
  const centralSeats = seatsRecord(centralResult);
  const categoryRmse = Object.fromEntries(
    CATEGORIES.map((partyId) => [partyId, rmse(forecasts.map((forecast) => forecast.errors[partyId]))]),
  ) as CategoryValues;
  const intervalDiagnostics = leaveOneElectionOutIntervalDiagnostics(forecasts);
  const covariance = covarianceMatrix(forecasts, current).map((row) => row.map((value) => value * intervalDiagnostics.scale ** 2));
  const covarianceRoot = cholesky(covariance);
  const random = createRandom(seed);

  const shareDraws = Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, [] as number[]])) as Record<SimulatorPartyId, number[]>;
  const seatDraws = Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, [] as number[]])) as Record<SimulatorPartyId, number[]>;
  const thresholdCounts = Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, 0])) as Record<SimulatorPartyId, number>;
  const largestCounts = Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, 0])) as Record<SimulatorPartyId, number>;
  const coalitionDefinitions: Array<Omit<ElectionForecast["coalitions"][number], "centralSeats" | "majorityProbability">> = [
    {
      id: "opposition-four",
      name: "S + V + MP + C",
      partyIds: OPPOSITION,
      status: "politically-contested",
      explanation: "Mandaten kan räcka, men C säger nej till V i regering. Majoritet är därför inte samma sak som en färdig koalition.",
    },
    {
      id: "red-green-three",
      name: "S + V + MP",
      partyIds: ["S", "V", "MP"],
      status: "arithmetical",
      explanation: "Mandat för tre rödgröna partier. Modellen antar inte att andra partier tolererar regeringen.",
    },
    {
      id: "andersson-center",
      name: "S + C + MP",
      partyIds: ["S", "C", "MP"],
      status: "politically-contested",
      explanation: "Ett Andersson-underlag utan V i regeringen; det behöver normalt stöd eller tolerans utifrån.",
    },
    {
      id: "center-crossbloc",
      name: "S + C + KD",
      partyIds: ["S", "C", "KD"],
      status: "politically-contested",
      explanation: "C har pekat på en sådan mittlösning, men partierna har inte en gemensam regeringsöverenskommelse.",
    },
    {
      id: "tido-four",
      name: "M + SD + KD + L",
      partyIds: TIDO,
      status: "declared",
      explanation: "De fyra Tidöpartiernas mandatbas. Det här är en mandatprognos, inte ett färdigt regeringsbeslut.",
    },
    {
      id: "tido-without-l",
      name: "M + SD + KD",
      partyIds: ["M", "SD", "KD"],
      status: "arithmetical",
      explanation: "Visar mandatläget utan L; det är inte ett separat deklarerat regeringsalternativ.",
    },
  ];
  const coalitionMajorities = Object.fromEntries(coalitionDefinitions.map((coalition) => [coalition.id, 0])) as Record<string, number>;
  let sdBeatsMCount = 0;
  let sevenPartiesCount = 0;
  let seatTieLotSimulations = 0;
  let simulationIndex = 0;
  const studentDegreesOfFreedom = 5;
  const studentVarianceScale = Math.sqrt((studentDegreesOfFreedom - 2) / studentDegreesOfFreedom);

  for (let pair = 0; pair < simulations / 2; pair += 1) {
    const normalVector = CATEGORIES.map(() => standardNormal(random));
    const chiSquare = Array.from({ length: studentDegreesOfFreedom }, () => standardNormal(random) ** 2).reduce((sum, value) => sum + value, 0);
    const heavyTailScale = studentVarianceScale * Math.sqrt(studentDegreesOfFreedom / Math.max(chiSquare, 1e-9));
    const shock = matrixVectorProduct(covarianceRoot, normalVector).map((value) => value * heavyTailScale);

    for (const sign of [1, -1]) {
      const raw = Object.fromEntries(CATEGORIES.map((category, index) => [
        category,
        Math.max(category === "OTHER" ? 0.1 : 0.03, current.shares[category] + sign * shock[index]),
      ])) as CategoryValues;
      const sampledShares = normalizeShares(raw);
      const result = simulateRiksdagScenario(baseline, sampledShares, { tieSeed: simulationTieSeed(seed, simulationIndex) }).result;
      if (result.tieBreaks.length > 0) seatTieLotSimulations += 1;
      const winner = [...FORECAST_PARTY_IDS].sort((left, right) => sampledShares[right] - sampledShares[left] || left.localeCompare(right))[0];
      largestCounts[winner] += 1;
      const simulatedSeats = seatsRecord(result);
      if (simulatedSeats.SD > simulatedSeats.M) sdBeatsMCount += 1;
      if (FORECAST_PARTY_IDS.filter((partyId) => simulatedSeats[partyId] > 0).length === 7) sevenPartiesCount += 1;
      for (const partyId of FORECAST_PARTY_IDS) {
        shareDraws[partyId].push(sampledShares[partyId]);
        seatDraws[partyId].push(simulatedSeats[partyId]);
        if (sampledShares[partyId] >= 4) thresholdCounts[partyId] += 1;
      }
      for (const coalition of coalitionDefinitions) {
        if (coalitionSeats(result, coalition.partyIds) >= 175) coalitionMajorities[coalition.id] += 1;
      }
      simulationIndex += 1;
    }
  }

  const parties = FORECAST_PARTY_IDS.map((partyId) => ({
    partyId,
    meanShare: round(current.shares[partyId], 1),
    shareInterval80: [round(quantile(shareDraws[partyId], 0.1), 1), round(quantile(shareDraws[partyId], 0.9), 1)] as [number, number],
    centralSeats: centralSeats[partyId],
    medianSeats: Math.round(quantile(seatDraws[partyId], 0.5)),
    seatInterval80: [Math.round(quantile(seatDraws[partyId], 0.1)), Math.round(quantile(seatDraws[partyId], 0.9))] as [number, number],
    thresholdProbability: round(thresholdCounts[partyId] / simulations, 4),
    largestPartyProbability: round(largestCounts[partyId] / simulations, 4),
    pollingDisagreement: round(current.disagreements[partyId], 2),
    historicalRmse: round(categoryRmse[partyId], 2),
    seatHistogram: seatHistogram(seatDraws[partyId]),
  }));

  const coalitions = coalitionDefinitions.map((coalition) => ({
    ...coalition,
    centralSeats: coalitionSeats(centralResult, coalition.partyIds),
    majorityProbability: round(coalitionMajorities[coalition.id] / simulations, 4),
  }));
  const coalitionById = new Map(coalitions.map((coalition) => [coalition.id, coalition]));
  const rawQuestions: ElectionForecast["questions"] = [
    {
      id: "opposition-majority",
      question: "Når S, V, MP och C minst 175 mandat?",
      probability: coalitionById.get("opposition-four")?.majorityProbability ?? 0,
      resultLabel: "Oppositionsmandat",
      category: "majority",
      resolution: "Ja om S, V, MP och C tillsammans tilldelas minst 175 av 349 mandat i Valmyndighetens slutliga riksdagsresultat.",
      explanation: "Det mäter mandatstyrka. Det säger inte att C och V accepterar samma regering.",
      classification: "MODEL",
    },
    {
      id: "tido-majority",
      question: "Når Tidöpartierna minst 175 mandat?",
      probability: coalitionById.get("tido-four")?.majorityProbability ?? 0,
      resultLabel: "Tidömajoritet",
      category: "majority",
      resolution: "Ja om M, SD, KD och L tillsammans tilldelas minst 175 mandat i slutresultatet.",
      explanation: "L:s spärrläge är den största enskilda risken för den deklarerade mandatbasen.",
      classification: "MODEL",
    },
    {
      id: "liberals-threshold",
      question: "Klarar Liberalerna riksdagsspärren?",
      probability: thresholdCounts.L / simulations,
      resultLabel: "L över 4 %",
      category: "threshold",
      resolution: "Ja om Liberalerna får minst 4,00 procent av de giltiga rösterna nationellt.",
      explanation: "Spärren gör små rörelser runt fyra procent mycket viktiga för mandatfördelningen.",
      classification: "MODEL",
    },
    {
      id: "christian-democrats-threshold",
      question: "Klarar Kristdemokraterna riksdagsspärren?",
      probability: thresholdCounts.KD / simulations,
      resultLabel: "KD över 4 %",
      category: "threshold",
      resolution: "Ja om Kristdemokraterna får minst 4,00 procent av de giltiga rösterna nationellt.",
      explanation: "Modellen väger mätningarnas mittpunkt mot historiska prognosfel och institutsspridning.",
      classification: "MODEL",
    },
    {
      id: "social-democrats-largest",
      question: "Blir Socialdemokraterna största parti?",
      probability: largestCounts.S / simulations,
      resultLabel: "S störst",
      category: "party",
      resolution: "Ja om Socialdemokraterna får högst nationell röstandel av de modellerade riksdagspartierna.",
      explanation: "Största parti påverkar förhandlingsläget men utser inte automatiskt statsministern.",
      classification: "MODEL",
    },
    {
      id: "sd-beats-m",
      question: "Får SD fler mandat än M?",
      probability: sdBeatsMCount / simulations,
      resultLabel: "SD större än M",
      category: "party",
      resolution: "Ja om Sverigedemokraterna tilldelas fler riksdagsmandat än Moderaterna i slutresultatet.",
      explanation: "Det påverkar styrkeförhållandet inom högerunderlaget men avgör inte automatiskt statsministerfrågan.",
      classification: "MODEL",
    },
    {
      id: "seven-parties",
      question: "Kommer exakt sju partier in i riksdagen?",
      probability: sevenPartiesCount / simulations,
      resultLabel: "Sju riksdagspartier",
      category: "parliament",
      resolution: "Ja om exakt sju av dagens åtta riksdagspartier får minst ett mandat.",
      explanation: "I centralprognosen faller L ur medan övriga sju partier får mandat.",
      classification: "MODEL",
    },
  ];
  const questions = rawQuestions.map((question) => ({ ...question, probability: round(question.probability, 4) }));

  const trend = trendPoints(options.polls, baseline, options.dataCutoff, FROZEN_CONFIGURATION, seed);
  const previous = trend.at(-2) ?? trend.at(-1);
  if (!previous) throw new Error("Forecast trend has no points");
  const allPartyErrors = forecasts.flatMap((forecast) => FORECAST_PARTY_IDS.map((partyId) => forecast.errors[partyId]));
  const calibrationErrors = calibration.flatMap((forecast) => FORECAST_PARTY_IDS.map((partyId) => forecast.errors[partyId]));
  const holdoutErrors = FORECAST_PARTY_IDS.map((partyId) => holdout.errors[partyId]);
  const backtests: ForecastBacktestElection[] = forecasts.map((forecast) => ({
    year: forecast.election.year,
    cutoff: forecast.cutoff,
    role: forecast.election.year === HOLDOUT_YEAR ? "holdout" : "calibration",
    polls: forecast.average.pollCount,
    houses: forecast.average.houseCount,
    meanAbsoluteError: round(forecast.meanAbsoluteError, 3),
    prediction: Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, round(forecast.average.shares[partyId], 2)])) as SimulatorPartyVotes,
    actual: Object.fromEntries(FORECAST_PARTY_IDS.map((partyId) => [partyId, forecast.actual[partyId]])) as SimulatorPartyVotes,
  }));
  const earliestYear = Math.min(...options.polls.map((poll) => Number.parseInt(poll.publishedMonth.slice(0, 4), 10)).filter(Number.isFinite));

  return {
    schemaVersion: 1,
    classification: "MODEL",
    status: "BETA",
    snapshotId: snapshotId(options.source, options.dataCutoff, seed),
    model: {
      id: "pv-election-forecast",
      version: MODEL_VERSION,
      averagingVersion: AVERAGING_VERSION,
      generatedAt: options.generatedAt,
      dataCutoff: options.dataCutoff,
      electionDate: FORECAST_ELECTION_DATE,
      horizonDays,
      seed,
      simulations,
      windowDays: FROZEN_CONFIGURATION.windowDays,
      halfLifeDays: FROZEN_CONFIGURATION.halfLifeDays,
      approximateFieldworkWeight: APPROXIMATE_FIELDWORK_WEIGHT,
      maximumHouseWeight: MAXIMUM_HOUSE_WEIGHT,
      uncertaintyMethod: "shrunk-nine-category-residual-covariance",
      simulationMethod: "antithetic-student-t",
      otherCategorySeatTreatment: "aggregate-assumed-seat-ineligible",
    },
    source: options.source,
    evidence: {
      pollBankRows: options.polls.length,
      pollBankStartYear: earliestYear,
      currentWindowPolls: current.pollCount,
      currentWindowHouses: current.houseCount,
      currentWindowInterviews: current.interviewCount,
      currentWindowApproximatePolls: current.approximatePollCount,
      effectivePollCount: round(current.effectivePollCount, 1),
      effectiveHouseCount: round(current.effectiveHouseCount, 1),
      maximumRealizedHouseWeight: round(current.maximumRealizedHouseWeight, 4),
      interviewsAreNonUnique: true,
      officialHistoryElections: 6,
      comparableBacktestElections: 4,
      calibrationElections: 3,
      holdoutElections: 1,
      backtestPartyOutcomes: 32,
      excludedCoverageAuditYears: [2002, 2006],
      officialConstituencies: 29,
      officialMunicipalities: 290,
    },
    quality: {
      calibrationMeanAbsoluteError: round(mean(calibrationErrors.map(Math.abs)), 3),
      holdoutMeanAbsoluteError: round(mean(holdoutErrors.map(Math.abs)), 3),
      allBacktestMeanAbsoluteError: round(mean(allPartyErrors.map(Math.abs)), 3),
      allBacktestRootMeanSquareError: round(rmse(allPartyErrors), 3),
      leaveOneElectionOutIntervalCoverage80: round(intervalDiagnostics.coverage, 3),
      intervalCalibrationScale: round(intervalDiagnostics.scale, 3),
      seatTieLotSimulations,
      seatTieLotRate: round(seatTieLotSimulations / simulations, 4),
      caveat: "Fyra val har komplett jämförbara åttapartimätningar. Den frysta designen bedöms på 2010–2018; 2022 är låst holdout. OTHER är en samlad restkategori som antas sakna mandatbehörigt nytt parti. Historiska fel garanterar inte 2026 och mandat är inte samma sak som regeringsmakt.",
    },
    pollingAverage: Object.fromEntries(CATEGORIES.map((partyId) => [partyId, round(current.shares[partyId], 2)])) as SimulatorPartyVotes & { OTHER: number },
    centralScenario: {
      seats: centralSeats,
      majoritySeats: 175,
      oppositionSeats: coalitionSeats(centralResult, OPPOSITION),
      tidoSeats: coalitionSeats(centralResult, TIDO),
      changeSincePreviousDataPoint: {
        date: previous.date,
        oppositionSeatDelta: coalitionSeats(centralResult, OPPOSITION) - previous.oppositionSeats,
        tidoSeatDelta: coalitionSeats(centralResult, TIDO) - previous.tidoSeats,
      },
    },
    parties,
    questions,
    coalitions,
    backtests,
    trend,
  };
}

export function validateForecastInputs(polls: PollObservation[], dataCutoff: string): void {
  const horizonDays = daysBetween(dataCutoff, FORECAST_ELECTION_DATE);
  if (horizonDays < 0) {
    throw new Error(`Forecast cutoff ${dataCutoff} is after election day ${FORECAST_ELECTION_DATE}`);
  }
  if (polls.length < 2_500) throw new Error(`Poll bank unexpectedly shrank to ${polls.length} rows`);
  const latestDate = polls.flatMap((poll) => poll.publishedAt ? [poll.publishedAt] : []).sort().at(-1);
  if (!latestDate || latestDate !== dataCutoff) throw new Error(`Expected latest poll publication ${dataCutoff}, received ${latestDate ?? "none"}`);
  const latest = qualifyingPolls(polls, dataCutoff, 14);
  if (latest.length < 2) throw new Error("At least two complete recent polls are required for a live forecast");

  const identities = new Set<string>();
  for (const poll of polls) {
    for (const [partyId, share] of Object.entries(poll.shares)) {
      if (!FORECAST_PARTY_IDS.includes(partyId as SimulatorPartyId)) throw new Error(`Unknown poll party ${partyId}`);
      if (!Number.isFinite(share) || share < 0 || share > 100) throw new Error(`Invalid ${partyId} share on poll CSV row ${poll.rowNumber}`);
    }
    if (poll.sampleSize !== null && (!Number.isInteger(poll.sampleSize) || poll.sampleSize <= 0)) throw new Error(`Invalid sample size on poll CSV row ${poll.rowNumber}`);
    if (poll.publishedAt) dateToEpoch(poll.publishedAt);
    if (poll.fieldworkFrom) dateToEpoch(poll.fieldworkFrom);
    if (poll.fieldworkTo) dateToEpoch(poll.fieldworkTo);
    if (poll.fieldworkFrom && poll.fieldworkTo && dateToEpoch(poll.fieldworkFrom) > dateToEpoch(poll.fieldworkTo)) {
      throw new Error(`Fieldwork dates are reversed on poll CSV row ${poll.rowNumber}`);
    }
    if (hasCompleteModernShares(poll)) {
      const total = FORECAST_PARTY_IDS.reduce((sum, partyId) => sum + poll.shares[partyId], 0);
      if (total < 70 || total > 105) throw new Error(`Impossible complete-party sum ${total.toFixed(1)} on poll CSV row ${poll.rowNumber}`);
    }
    const identity = JSON.stringify([poll.company, poll.publishedAt, poll.fieldworkFrom, poll.fieldworkTo, poll.sampleSize, poll.shares]);
    if (identities.has(identity)) throw new Error(`Duplicate poll observation on CSV row ${poll.rowNumber}`);
    identities.add(identity);
  }
}
