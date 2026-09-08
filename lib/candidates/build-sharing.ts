import { createHash } from "node:crypto";
import { candidateSharingData } from "./sharing-data";
import { validateSharePerson, type SharePerson } from "./sharing";
import type { Person } from "./types";

export function buildSharePerson(person: Person): SharePerson {
  const payload = candidateSharingData(person);
  const result = { ...payload, revision: createHash("sha256").update(JSON.stringify(payload)).digest("hex") };
  validateSharePerson(result, person.id);
  return result;
}
