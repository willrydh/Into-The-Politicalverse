import type { PollObservation } from "./types";

export const POLLS_ADAPTER_VERSION = "pv-swedishpolls-1.1.0";

// Preserve the immutable upstream CSV. Apply reviewed primary-source corrections
// only in the adapter, with provenance also included in the public forecast.
export const PUBLICATION_DATE_CORRECTIONS = [{
  company: "Novus",
  fieldworkFrom: "2026-08-24",
  fieldworkTo: "2026-08-30",
  originalPublishedAt: "2026-09-01",
  publishedAt: "2026-09-02",
  sourceUrl: "https://novus.se/wp-content/uploads/2026/09/novusvaljarbarometerseptember2026h3q8v5.pdf",
  checkedAt: "2026-09-06",
}] as const;

export function correctPollPublicationDates(polls: PollObservation[]): PollObservation[] {
  return polls.map((poll) => {
    const correction = PUBLICATION_DATE_CORRECTIONS.find((entry) => entry.company === poll.company
      && entry.fieldworkFrom === poll.fieldworkFrom && entry.fieldworkTo === poll.fieldworkTo);
    if (!correction) return poll;
    if (poll.publishedAt !== correction.originalPublishedAt && poll.publishedAt !== correction.publishedAt) {
      throw new Error("Reviewed Novus publication date changed upstream; refusing an ambiguous correction");
    }
    return { ...poll, publishedAt: correction.publishedAt };
  });
}
