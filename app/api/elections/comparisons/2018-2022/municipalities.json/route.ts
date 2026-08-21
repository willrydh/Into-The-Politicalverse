import { getMunicipalityComparisons, municipalityHistory2018, riksdag2022 } from "@/lib/data/elections";

export const dynamic = "force-static";

export function GET() {
  const comparisons = getMunicipalityComparisons().map(({ code, name, turnoutChange, swings }) => ({ code, name, turnoutChange, swings }));
  return Response.json({
    classification: "DERIVED",
    methodology: { id: "municipality-swing", version: "1.0.0", unit: "percentage points" },
    elections: [municipalityHistory2018.election, riksdag2022.election],
    geographyComparison: municipalityHistory2018.geographyComparison,
    comparisons,
    sources: [municipalityHistory2018.source, riksdag2022.source],
  });
}
