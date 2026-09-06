export type Locality = { code: string; name: string; municipalities: string[] };
export type LocalityData = {
  schemaVersion: 1; year: 2023;
  source: { publisher: "SCB"; url: string; retrievedAt: string; sha256: string; namesUpdatedAt: string };
  localities: Locality[];
};
export function validateLocalities(data: LocalityData, municipalities: Set<string>) {
  if (data.schemaVersion !== 1 || data.year !== 2023 || data.source.publisher !== "SCB" || new URL(data.source.url).hostname !== "www.scb.se" || !/^[a-f0-9]{64}$/.test(data.source.sha256)) throw new Error("Invalid SCB locality provenance");
  if (data.localities.length !== 2017 || new Set(data.localities.map(l => l.code)).size !== 2017) throw new Error("Expected 2,017 distinct SCB 2023 localities");
  let relations = 0;
  for (const l of data.localities) {
    if (!/^\d{4}T[BC]\d{3}$/.test(l.code) || !l.name || !l.municipalities.length || new Set(l.municipalities).size !== l.municipalities.length || l.municipalities.some(c => !municipalities.has(c))) throw new Error(`Invalid locality ${l.code}`);
    relations += l.municipalities.length;
  }
  if (relations !== 2144) throw new Error("Expected every SCB municipality relation, including split localities");
}
