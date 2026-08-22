import rawGovernmentFormationContext from "@/data/context/government-formation-2026.json";
import { isIsoDateStamp } from "@/lib/dates";
import type { SimulatorPartyId } from "@/lib/simulator/types";

export const GOVERNMENT_SOURCE_CLASSES = [
  "OFFICIAL_PRIMARY",
  "PARTY_PRIMARY",
  "PUBLIC_SERVICE_REPORTING",
  "EDITORIAL_REPORTING",
] as const;

export type GovernmentSourceClass = (typeof GOVERNMENT_SOURCE_CLASSES)[number];
export type GovernmentClaimClassification = "DECLARED" | "CONTEXT";

export type GovernmentContextSource = {
  readonly publisher: string;
  readonly sourceClass: GovernmentSourceClass;
  readonly title: string;
  readonly url: string;
  readonly publishedAt: string | null;
  readonly effectiveAt: string | null;
  readonly checkedAt: string;
};

export type GovernmentContextClaim = {
  readonly id: string;
  readonly classification: GovernmentClaimClassification;
  readonly headline: string;
  readonly summary: string;
  readonly consequence: string;
  readonly source: GovernmentContextSource;
};

export type GovernmentPartyContext = {
  readonly partyId: SimulatorPartyId;
  readonly leaders: readonly string[];
  readonly leaderTitle: string;
  readonly leaderSource: GovernmentContextSource;
  readonly claims: readonly GovernmentContextClaim[];
};

export type GovernmentFormationContext = {
  readonly schemaVersion: 1;
  readonly id: "se-government-formation-2026";
  readonly country: "SE";
  readonly electionDate: "2026-09-13";
  readonly classification: "CONTEXT";
  readonly checkedAt: string;
  readonly methodNote: string;
  readonly constitutionalClaims: readonly GovernmentContextClaim[];
  readonly partyContexts: readonly GovernmentPartyContext[];
};

const PARTY_IDS = new Set<SimulatorPartyId>(["S", "SD", "M", "V", "C", "KD", "MP", "L"]);
const SOURCE_CLASSES = new Set<string>(GOVERNMENT_SOURCE_CLASSES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid government context: ${path} must be a non-empty string.`);
  }
}

function assertSource(value: unknown, path: string, contextCheckedAt: string): asserts value is GovernmentContextSource {
  if (!isRecord(value)) throw new Error(`Invalid government context: ${path} must be an object.`);
  assertString(value.publisher, `${path}.publisher`);
  assertString(value.title, `${path}.title`);
  assertString(value.url, `${path}.url`);
  if (!value.url.startsWith("https://")) throw new Error(`Invalid government context: ${path}.url must use HTTPS.`);
  if (!SOURCE_CLASSES.has(String(value.sourceClass))) throw new Error(`Invalid government context: ${path}.sourceClass is unknown.`);
  for (const field of ["publishedAt", "effectiveAt"] as const) {
    if (value[field] !== null && !isIsoDateStamp(value[field])) {
      throw new Error(`Invalid government context: ${path}.${field} must be an ISO date or null.`);
    }
  }
  if (!isIsoDateStamp(value.checkedAt) || value.checkedAt !== contextCheckedAt) {
    throw new Error(`Invalid government context: ${path}.checkedAt must match the registry check date.`);
  }
}

function assertClaim(
  value: unknown,
  path: string,
  contextCheckedAt: string,
  allowedClassification: GovernmentClaimClassification,
): asserts value is GovernmentContextClaim {
  if (!isRecord(value)) throw new Error(`Invalid government context: ${path} must be an object.`);
  assertString(value.id, `${path}.id`);
  assertString(value.headline, `${path}.headline`);
  assertString(value.summary, `${path}.summary`);
  assertString(value.consequence, `${path}.consequence`);
  if (value.classification !== allowedClassification) {
    throw new Error(`Invalid government context: ${path}.classification must be ${allowedClassification}.`);
  }
  assertSource(value.source, `${path}.source`, contextCheckedAt);
}

function assertGovernmentFormationContext(value: unknown): asserts value is GovernmentFormationContext {
  if (!isRecord(value)) throw new Error("Invalid government context: root must be an object.");
  if (value.schemaVersion !== 1 || value.id !== "se-government-formation-2026" || value.country !== "SE") {
    throw new Error("Invalid government context: unsupported registry identity or schema.");
  }
  if (value.electionDate !== "2026-09-13" || value.classification !== "CONTEXT" || !isIsoDateStamp(value.checkedAt)) {
    throw new Error("Invalid government context: election metadata is incomplete.");
  }
  assertString(value.methodNote, "methodNote");

  if (!Array.isArray(value.constitutionalClaims) || value.constitutionalClaims.length < 2) {
    throw new Error("Invalid government context: constitutional claims are missing.");
  }
  value.constitutionalClaims.forEach((claim, index) => {
    assertClaim(claim, `constitutionalClaims[${index}]`, value.checkedAt as string, "CONTEXT");
  });

  if (!Array.isArray(value.partyContexts) || value.partyContexts.length !== PARTY_IDS.size) {
    throw new Error("Invalid government context: all eight parliamentary parties must be represented once.");
  }

  const seenParties = new Set<string>();
  const seenClaims = new Set<string>();
  for (const [index, partyContext] of value.partyContexts.entries()) {
    const path = `partyContexts[${index}]`;
    if (!isRecord(partyContext) || !PARTY_IDS.has(partyContext.partyId as SimulatorPartyId)) {
      throw new Error(`Invalid government context: ${path}.partyId is unknown.`);
    }
    if (seenParties.has(partyContext.partyId as string)) {
      throw new Error(`Invalid government context: duplicate party ${partyContext.partyId as string}.`);
    }
    seenParties.add(partyContext.partyId as string);
    if (!Array.isArray(partyContext.leaders) || partyContext.leaders.length === 0) {
      throw new Error(`Invalid government context: ${path}.leaders must not be empty.`);
    }
    partyContext.leaders.forEach((leader, leaderIndex) => assertString(leader, `${path}.leaders[${leaderIndex}]`));
    assertString(partyContext.leaderTitle, `${path}.leaderTitle`);
    assertSource(partyContext.leaderSource, `${path}.leaderSource`, value.checkedAt as string);
    if (!Array.isArray(partyContext.claims) || partyContext.claims.length === 0) {
      throw new Error(`Invalid government context: ${path}.claims must not be empty.`);
    }
    partyContext.claims.forEach((claim, claimIndex) => {
      assertClaim(claim, `${path}.claims[${claimIndex}]`, value.checkedAt as string, "DECLARED");
      if (seenClaims.has(claim.id)) throw new Error(`Invalid government context: duplicate claim ${claim.id}.`);
      seenClaims.add(claim.id);
    });
  }
}

const parsedGovernmentFormationContext: unknown = rawGovernmentFormationContext;
assertGovernmentFormationContext(parsedGovernmentFormationContext);

export const governmentFormationContext = parsedGovernmentFormationContext;

export function getGovernmentPartyContext(partyId: SimulatorPartyId): GovernmentPartyContext {
  const context = governmentFormationContext.partyContexts.find((candidate) => candidate.partyId === partyId);
  if (!context) throw new Error(`Government context is missing party ${partyId}.`);
  return context;
}

export function getConstitutionalClaim(id: string): GovernmentContextClaim {
  const claim = governmentFormationContext.constitutionalClaims.find((candidate) => candidate.id === id);
  if (!claim) throw new Error(`Government context is missing constitutional claim ${id}.`);
  return claim;
}
