import type { CandidateCatalog, CandidateElection } from "./types";

export function candidateCoverageSelection(catalog: CandidateCatalog, election: CandidateElection, county = "", area = "") {
  const coverage = catalog.coverage2026?.[election];
  const all = election === "KF" ? catalog.municipalities.map(a => ({code: a.code, county: a.parent})) : election === "RD" ? catalog.constituencies : catalog.counties.filter(a => a.code !== "09").map(a => ({code: a.code, county: a.code}));
  const selection = all.filter(a => (!county || a.county === county) && (!area || a.code === area));
  const counted = selection.filter(a => (coverage?.counted ?? coverage?.final ?? []).includes(a.code)).length;
  const final = selection.filter(a => coverage?.final.includes(a.code)).length;
  return {expected: selection.length, counted, final, complete: counted > 0 && counted === selection.length, established: final > 0 && final === selection.length, county: county || all.find(a => a.code === area)?.county};
}
