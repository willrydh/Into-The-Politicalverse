import type { SwingDiagnostics } from "./adaptive-swing";

export const NOWCAST_SUPPORT = {
  matchedDistricts: 50,
  effectiveDistricts: 40,
  municipalities: 20,
  constituencies: 8,
  coverage: 0.01,
  comparableReportedShare: 0.7,
  maximumExtrapolatedVoteShare: 0.25,
} as const;

/** Earlier publication depends on independent support, not just district count. */
export function nowcastReady(e: {
  matchedDistricts: number;
  representedConstituencies: number;
  matchedCoverage: number;
  comparableReportedShare: number;
  diagnostics?: SwingDiagnostics;
}): boolean {
  const d = e.diagnostics,
    s = NOWCAST_SUPPORT;
  return (
    !!d &&
    e.matchedDistricts >= s.matchedDistricts &&
    e.representedConstituencies >= s.constituencies &&
    e.matchedCoverage >= s.coverage &&
    e.comparableReportedShare >= s.comparableReportedShare &&
    d.effectiveDistricts >= s.effectiveDistricts &&
    d.municipalities >= s.municipalities &&
    d.extrapolatedVoteShare <= s.maximumExtrapolatedVoteShare &&
    d.crossValidationMaePp !== null &&
    Number.isFinite(d.crossValidationMaePp)
  );
}
