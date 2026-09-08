/** Display only. Sorting and calculations always use the unrounded number. */
export function compactCandidateNumber(value: number, sv: boolean, decimals = 1) {
  const abs = Math.abs(value);
  const scale = abs >= 999_950 ? 1_000_000 : abs >= 1_000 ? 1_000 : 1;
  const suffix = scale === 1_000_000 ? "M" : scale === 1_000 ? (sv ? "t" : "k") : "";
  return `${(value / scale).toLocaleString(sv ? "sv-SE" : "en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}
