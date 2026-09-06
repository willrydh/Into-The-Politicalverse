import { isoDateToEpoch } from "../dates";

export const STALE_POLL_DAYS = 7;

/** A display policy, separate from the frozen statistical model. */
export function forecastFreshness(dataCutoff: string, electionDate: string, today: string) {
  const ageDays = Math.round((isoDateToEpoch(today) - isoDateToEpoch(dataCutoff)) / 86_400_000);
  isoDateToEpoch(electionDate);
  if (today > electionDate) return { state: "archived", ageDays, message: "Arkiverad förvalsprognos. Visar inte valresultatet." } as const;
  if (ageDays < 0) return { state: "unknown", ageDays, message: "Datastoppet ligger efter datumet på din enhet." } as const;
  if (ageDays > STALE_POLL_DAYS) return { state: "stale", ageDays, message: `Underlaget är ${ageDays} dagar gammalt. Nyare mätningar kan saknas.` } as const;
  return {
    state: "recent",
    ageDays,
    message: ageDays === 0 ? "Senaste mätningen publicerades i dag." : ageDays === 1 ? "Senaste mätningen publicerades i går." : `Senaste mätningen publicerades för ${ageDays} dagar sedan.`,
  } as const;
}
