import { ELECTION_TYPES, type CandidateElection, type Person } from "./types";

// One selection rule for the visible profile and its server-rendered sharing card.
// A leaderboard's `year` parameter selects standings, not this latest-result panel.
export function selectCandidateProfile(person: Person, params: URLSearchParams) {
  const available = ELECTION_TYPES.filter(t => person.results.some(r => r.electionType === t));
  const requested = params.get("election") as CandidateElection;
  const latestYear = Math.max(...person.results.map(r => r.year));
  const latestElections = available.filter(t => person.results.some(r => r.electionType === t && r.year === latestYear));
  const election = available.includes(requested) ? requested : latestElections.includes("KF") ? "KF" : latestElections[0];
  const mainResults = person.results.filter(r => r.electionType === election && (election === "RD" || r.level !== "constituency"));
  const areas = [...new Map(mainResults.map(r => [r.areaCode, { code: r.areaCode, name: r.areaName }])).values()];
  const latestElectionYear = Math.max(...mainResults.map(r => r.year));
  const area = areas.some(a => a.code === params.get("area")) ? params.get("area")! : mainResults.find(r => r.year === latestElectionYear)?.areaCode;
  const results = mainResults.filter(r => r.areaCode === area).sort((a, b) => a.year - b.year || a.partyCode.localeCompare(b.partyCode));
  return { available, election, areas, area, results, latest: results.at(-1)! };
}
