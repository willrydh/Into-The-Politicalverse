import { AREA_METHOD, areaKey, type AreaFeed, type AreaResult } from "./area-types";
import { attachMunicipalSummary, normalizeAreaResult } from "./area-adapter";
import { areaIndexEntries, digest, download, downloadIndexedArchive, INDEX_URLS, readSignedArchive } from "./official-files";
import { normalizeResult } from "./result-adapter";
import { insist } from "./validation";
import geography from "../../data/normalized/local-election-index.json";
import { attachMapDistricts } from "./map-district-adapter";

export function emptyAreaFeed(now: string): AreaFeed {
  return { schemaVersion: 1, methodVersion: AREA_METHOD, classification: "OFFICIAL", electionDate: "2026-09-13", checkedAt: now, indexSha256: null, status: "ok", published: { preliminary: { RD: 0, RF: 0, KF: 0 }, "final-count": { RD: 0, RF: 0, KF: 0 } }, failures: [], results: {} };
}

/** Independent archives: an unavailable municipality never blocks national votes. */
export async function collectAreaResults(previous: AreaFeed, options: { now: string; certificate: Buffer; fetchFile?: typeof download }): Promise<{ feed: AreaFeed; errors: string[] }> {
  insist(previous.methodVersion === AREA_METHOD && previous.classification === "OFFICIAL" && previous.electionDate === "2026-09-13", "Incompatible area feed");
  const feed = structuredClone(previous), errors: string[] = [], fetchFile = options.fetchFile ?? download;
  feed.checkedAt = options.now; feed.failures = [];
  const deadline = Date.now() + 4 * 60_000;
  try {
    const index = await fetchFile(INDEX_URLS.production, 256 * 1024);
    insist(index, "Missing area index");
    const entries = areaIndexEntries(index.toString("utf8"));
    feed.indexSha256 = digest(index);
    feed.published = emptyAreaFeed(options.now).published;
    for (const entry of entries) {
      insist(entry.electionType === "RD" || (entry.electionType === "KF" ? geography.municipalities.some(m => m.code === entry.code) : entry.code !== "09" && geography.counties.some(c => c.code === entry.code)), `Unreviewed 2026 administrative area ${entry.electionType}/${entry.code}`);
      feed.published[entry.stage][entry.electionType]++;
    }
    const available = new Set(entries.map(e => areaKey(e.electionType, e.code, e.stage)));
    for (const key of Object.keys(feed.results)) if (!available.has(key)) { feed.failures.push(key); errors.push(`${key}: previously published archive is missing`); }
    let cursor = 0;
    // Limit authority traffic and peak decompression memory. No requests for unchanged archives.
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (cursor < entries.length) {
        const entry = entries[cursor++], key = areaKey(entry.electionType, entry.code, entry.stage), old = feed.results[key];
        if (old?.source.archiveMd5 === entry.md5 && old.districts && old.districtSource) continue;
        if (Date.now() >= deadline) { feed.failures.push(key); errors.push(`${key}: bounded collection deadline reached`); continue; }
        try {
          const consistent = await downloadIndexedArchive(entry, { mode: "production", stage: entry.stage, area: entry, fetchFile });
          const input = { mode: "production" as const, stage: entry.stage, area: entry, certificate: options.certificate, now: options.now };
          const signed = await readSignedArchive(consistent.archive, consistent.entry, input);
          let result: AreaResult;
          if (entry.electionType === "RD") {
            const r = normalizeResult(signed.raw, { ...input, source: signed.source });
            result = { electionType: "RD", stage: r.stage, sourceUpdatedAt: r.sourceUpdatedAt, sourceRevision: r.sourceRevision, area: r.national, totalSeats: 349, protocolUrl: r.protocolUrl, source: r.source, summarySource: null, municipalities: [] };
          } else result = normalizeAreaResult(signed.raw, { ...entry, now: options.now, source: signed.source });
          if (entry.electionType !== "KF") {
            const summary = await readSignedArchive(consistent.archive, consistent.entry, { ...input, kind: "summering" });
            attachMunicipalSummary(result, summary.raw, summary.source, options.now);
            insist(result.municipalities.every(m => geography.municipalities.some(g => g.code === m.code && g.parent === m.countyCode)), "Unreviewed municipality identity");
          }
          try {
            const districts = await readSignedArchive(consistent.archive, consistent.entry, { ...input, kind: "rostfordelning" });
            attachMapDistricts(result, districts.raw, districts.source, options.now);
          } catch (error) {
            // An auxiliary map failure cannot discard validated current totals.
            // Do not attach an older district generation to a newer summary.
            delete result.districts; delete result.districtSource;
            feed.failures.push(key); errors.push(`${key}: district map unavailable: ${error instanceof Error ? error.message : String(error)}`);
          }
          if (old) {
            insist(result.sourceRevision >= old.sourceRevision && result.sourceUpdatedAt >= old.sourceUpdatedAt, "Area source regressed");
            if (result.sourceRevision === old.sourceRevision) insist(result.source.jsonSha256 === old.source.jsonSha256, "Same area revision changed contents");
          }
          feed.results[key] = result;
        } catch (error) {
          feed.failures.push(key); errors.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }));
  } catch (error) { feed.failures.push("index"); errors.push(error instanceof Error ? error.message : String(error)); }
  feed.failures.sort(); feed.status = feed.failures.length ? "degraded" : "ok";
  feed.results = Object.fromEntries(Object.entries(feed.results).sort(([a], [b]) => a.localeCompare(b)));
  return { feed, errors };
}
