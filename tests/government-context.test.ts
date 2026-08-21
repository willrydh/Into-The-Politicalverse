import assert from "node:assert/strict";
import test from "node:test";
import {
  getConstitutionalClaim,
  governmentFormationContext,
  type GovernmentContextClaim,
} from "../lib/forecast/government";

const EXPECTED_LEADERS = {
  S: ["Magdalena Andersson"],
  M: ["Ulf Kristersson"],
  SD: ["Jimmie Åkesson"],
  V: ["Nooshi Dadgostar"],
  C: ["Elisabeth Thand Ringqvist"],
  KD: ["Ebba Busch"],
  MP: ["Amanda Lind", "Daniel Helldén"],
  L: ["Simona Mohamsson"],
} as const;

function allClaims(): GovernmentContextClaim[] {
  return [
    ...governmentFormationContext.constitutionalClaims,
    ...governmentFormationContext.partyContexts.flatMap((party) => party.claims),
  ];
}

test("government context contains all current parliamentary party leaders", () => {
  assert.equal(governmentFormationContext.partyContexts.length, 8);
  assert.deepEqual(
    Object.fromEntries(governmentFormationContext.partyContexts.map((party) => [party.partyId, party.leaders])),
    EXPECTED_LEADERS,
  );
});

test("every political claim is classified, dated, and linked to an HTTPS source", () => {
  for (const claim of allClaims()) {
    assert.ok(claim.classification === "DECLARED" || claim.classification === "CONTEXT");
    assert.match(claim.source.url, /^https:\/\//);
    assert.equal(claim.source.checkedAt, governmentFormationContext.checkedAt);
    assert.ok(claim.source.publishedAt !== null || claim.source.effectiveAt !== null || claim.source.checkedAt.length > 0);
  }
});

test("constitutional context separates own majority, tolerability, and minister appointment", () => {
  const parliamentarism = getConstitutionalClaim("negative-parliamentarism");
  const ministers = getConstitutionalClaim("prime-minister-appoints-ministers");

  assert.match(`${parliamentarism.headline} ${parliamentarism.summary}`, /175 nej/);
  assert.match(parliamentarism.consequence, /inte samma sak som sannolikheten att en statsminister tolereras/);
  assert.match(`${ministers.summary} ${ministers.consequence}`, /statsministern.*utser|utser.*ministrar/i);
  assert.match(ministers.consequence, /inga sannolikheter på enskilda framtida ministrar/);
});

test("registry contains no fabricated person probability fields", () => {
  const serialized = JSON.stringify(governmentFormationContext);
  assert.doesNotMatch(serialized, /ministerProbability|leaderProbability|primeMinisterProbability|personOdds/);
  assert.match(governmentFormationContext.methodNote, /inga personodds/);
});
