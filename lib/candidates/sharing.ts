// Public transport contract, independent of the history importer's enabled years.
// Only the verified history build may publish these files. No live/staged feed is read.
export const SHARE_SCHEMA = 1;
export const SHARE_DESIGN = "candidate-card-2";
export type ShareLocale = "sv" | "en";
export type ShareScope = {
  election: "RD" | "RF" | "KF"; area: string; areaName: string;
  year: number; party: string; votes: number; percent: number | null;
  previousParty: string | null;
  reason: "comparable" | "no-baseline" | "zero-baseline" | "changed-area" | "replaced-election" | "multiple-parties";
  status: "final";
  candidacies: { year: number; partyCode: string; party: string; county: string }[];
  history: { year: number; votes: number | null; party: string; connect: boolean }[];
};
export type SharePerson = { id: string; name: string; revision: string; defaultElection: string; scopes: ShareScope[] };
export type ShareShard = { schemaVersion: 1; sourceVersion: string; counties: { code: string; name: string }[]; people: Record<string, SharePerson> };

export function selectShareScope(person: SharePerson, params: URLSearchParams) {
  const election = person.scopes.some(s => s.election === params.get("election")) ? params.get("election") : person.defaultElection;
  const scopes = person.scopes.filter(s => s.election === election);
  return scopes.find(s => s.area === params.get("area")) ?? scopes[0];
}

export function validateSharePerson(value: unknown, id: string): asserts value is SharePerson {
  const assert: (ok: unknown) => asserts ok = ok => { if (!ok) throw new Error("Invalid candidate sharing data"); };
  assert(value && typeof value === "object");
  const p = value as SharePerson;
  const text = (s: unknown) => typeof s === "string" && s.length > 0 && s.length <= 300;
  const year = (n: number) => Number.isInteger(n) && n >= 1900 && n <= 9996;
  const votes = (n: number) => Number.isSafeInteger(n) && n >= 0;
  assert(p.id === id && /^p\d{4}-\d{1,12}$/.test(id) && text(p.name) && /^[a-f0-9]{64}$/.test(p.revision));
  assert(Array.isArray(p.scopes) && p.scopes.length > 0 && p.scopes.length <= 1000);
  assert(p.scopes.some(s => s.election === p.defaultElection));
  const keys = new Set<string>();
  for (const s of p.scopes) {
    assert(["RD", "RF", "KF"].includes(s.election) && /^\d{2,6}$/.test(s.area) && text(s.areaName));
    const key = `${s.election}:${s.area}`; assert(!keys.has(key)); keys.add(key);
    assert(year(s.year) && text(s.party) && votes(s.votes) && s.status === "final");
    assert(s.previousParty === null || text(s.previousParty));
    assert(["comparable", "no-baseline", "zero-baseline", "changed-area", "replaced-election", "multiple-parties"].includes(s.reason));
    assert(s.reason === "comparable" ? Number.isFinite(s.percent) && s.percent! >= -100 : s.percent === null);
    assert(Array.isArray(s.candidacies) && s.candidacies.length > 0 && s.candidacies.length <= 1000);
    const candidacies = new Set<string>();
    for (const c of s.candidacies) {
      const key = `${c.year}:${c.partyCode}`;
      assert(year(c.year) && c.year <= s.year && /^\d+$/.test(c.partyCode) && text(c.party) && /^\d{2}$/.test(c.county) && !candidacies.has(key));
      candidacies.add(key);
    }
    assert(Array.isArray(s.history) && s.history.length > 0 && s.history.length <= 100);
    for (const [i, point] of s.history.entries()) {
      assert(year(point.year) && point.year <= s.year && (point.votes === null || votes(point.votes)) && typeof point.party === "string" && point.party.length <= 300 && typeof point.connect === "boolean");
      assert(i === 0 ? !point.connect : point.year > s.history[i - 1].year);
      if (point.connect) assert(point.votes !== null && s.history[i - 1].votes !== null && point.year === s.history[i - 1].year + 4);
    }
    assert(s.history.at(-1)!.year === s.year);
  }
}

export const electionShareLabel = (s: ShareScope, locale: ShareLocale) => ({
  sv: { RD: "Riksdagsvalkrets", RF: "Regionfullmäktige", KF: "Kommunfullmäktige" },
  en: { RD: "Riksdag constituency", RF: "Regional council", KF: "Municipal council" },
})[locale][s.election];

export function shareReason(reason: ShareScope["reason"], locale: ShareLocale) {
  return ({
    sv: { comparable: "", "no-baseline": "Tidigare jämförbart resultat saknas", "zero-baseline": "Föregående val: 0 röster", "changed-area": "Förändrat valområde", "replaced-election": "Omval – ej jämförbart", "multiple-parties": "Flera kandidaturer – ej jämförbart" },
    en: { comparable: "", "no-baseline": "No comparable previous result", "zero-baseline": "Previous election: 0 votes", "changed-area": "Changed electoral area", "replaced-election": "Re-run – not comparable", "multiple-parties": "Multiple candidacies – not comparable" },
  })[locale][reason];
}

export const shareNumber = (n: number, locale: ShareLocale, decimals = 0) => n.toLocaleString(locale === "sv" ? "sv-SE" : "en-GB", { maximumFractionDigits: decimals }).replace(/\u00a0/g, " ");
export const sharePercent = (s: ShareScope, locale: ShareLocale) => s.percent === null ? "—" : `${s.percent > 0 ? "+" : s.percent < 0 ? "−" : ""}${shareNumber(Math.abs(s.percent), locale, 1)} %`;
export const shareTitle = (p: SharePerson, s: ShareScope) => `${p.name} (${s.party}) · Politicalverse`;
export function shareDescription(p: SharePerson, s: ShareScope, locale: ShareLocale) {
  return `${p.name} (${s.party}) · ${electionShareLabel(s, locale)} · ${s.areaName} · ${s.year}. ${shareNumber(s.votes, locale)} ${locale === "sv" ? "personröster" : "personal votes"}. ${s.percent === null ? shareReason(s.reason, locale) : `${sharePercent(s, locale)} ${locale === "sv" ? "sedan" : "since"} ${s.year - 4}`}.`;
}
