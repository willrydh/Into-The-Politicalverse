import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCandidateData, buildCandidateSearch } from "../lib/candidates/build";
import { personShard, type PersonShard } from "../lib/candidates/types";

const { catalog, people, rankings } = getCandidateData();
const root = join(process.cwd(), "public/api/candidates");
function write(path: string, data: unknown) { mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), JSON.stringify(data)); }
write("index.json", catalog);
const shards: Record<string, PersonShard> = {};
for (const person of people) {
  const shard = personShard(person.id);
  (shards[shard] ??= { schemaVersion: 1, version: catalog.version, people: {} }).people[person.id] = person;
}
for (const [shard, data] of Object.entries(shards)) write(`people/${shard}.json`, data);
for (const [key, data] of rankings) {
  write(`rankings/${key}.json`, data);
  if (data.electionType === "RD") for (const area of catalog.constituencies) write(`areas/${data.year}-${area.code}.json`, { schemaVersion: 1, version: catalog.version, year: data.year, electionType: "RD", code: area.code, name: area.name, rows: data.rows.filter(r => r.areaCode === area.code) });
}
console.log(`Candidate data: ${catalog.people} profiles, ${catalog.linkedPeople} linked histories, ${catalog.electionIdentities} source identities; ${rankings.size} ranking files.`);

write("search.json",buildCandidateSearch());
