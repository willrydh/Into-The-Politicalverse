# Personal votes, recurring candidacies and leaderboards v1

Version: `candidate-history-1.0.2`. Published surfaces: `/rankings/`, `/people/`, the map’s personal-vote table, and universal search. All have Swedish and English versions.

The 1.0.1 correction uses the official party codes `0055` for Miljöpartiet and `0068` for Kristdemokraterna. Version 1.0.0 assigned different codes to their historical records and classified their 2022 candidates as Other, which could falsely indicate a party change. All four elections are regenerated from the same checksum-pinned originals. Vote counts, denominators, candidate identities, matching rules and change formulas are unchanged. Build and client validation now reject mismatched party codes/identities. The source manifest retains the previous output checksums and the correction record.

## Classification and scope

Vote counts, candidate numbers, names, ballot lists and party codes are OFFICIAL observations from Valmyndigheten. Cross-election identities, changes, aggregate regional/municipal results and leaderboard positions are DERIVED. The records describe candidacies, not verified party-membership dates or judgments about a politician. No prediction or odds are calculated.

Printed ballot-list positions are OFFICIAL observations. `ballotPositions` retains each distinct `{listNumber, position}` within the result's election, party and area. Municipal and regional results take the union across source constituencies; duplicate appearances of the same printed list/position are displayed once. The existing `lists` field still counts source constituency/list rows and is not a unique printed-list count. The UI shows all distinct position numbers (with expandable list numbers), not a minimum, mean, post-count ranking or inferred elected position. Empty source metadata is unavailable, never position zero. Previous-election comparisons carry the previous candidacy's own list positions, including when the party changed.

Seeing more personal votes alongside a higher list position does not isolate the effect of that position. These views make the context observable but do not adjust growth percentages or estimate a causal relationship. Vote arithmetic and identity linking are unchanged. The derived leaderboard extension below defines the explicit down-ballot subset and the Riksdag total-vote view.

Ballot coverage follows the final personal-vote result files. Other registered lists that are not represented there may be absent; the UI and source catalogue state this limitation. The current observations are not a complete nomination register.

Imported regular elections are 2010, 2014, 2018 and 2022, across Riksdag (RD), region/county council (RF) and municipal council (KF). Constituency observations remain separate from administrative aggregates. Municipal totals sum each municipal constituency once; regional totals sum each regional constituency once. Riksdag observations retain one entry per candidate **and constituency**. Since leaderboard method `candidate-leaderboards-1.0.0`, the total-votes view sums these disjoint observations per person and actual party within the selected geography, showing one row with an expandable constituency breakdown. Comparison views keep each constituency separate. Accepted overseas votes remain in the official Riksdag totals, and are not added again.

Original regular-election observations followed by re-runs are retained and marked: 2010 Västra Götaland RF; 2010 Örebro north-eastern KF constituency and the affected municipal aggregate; 2014 Båstad KF; 2018 Falun KF. They are excluded from leaderboards and change comparisons. The replacement elections of 2011, 2015 and 2019 are not imported by this version.

## One election identity is not a lifetime identity

Valmyndigheten candidate numbers identify candidates within one election. Never join elections on candidate number alone.

The linker requires the same complete normalized source name, a compatible age and a municipality shared in the official candidacy/residence metadata. Name normalization preserves diacritics, normalizes Unicode and case, and treats hyphens/whitespace equivalently. Source spellings attached to the same election candidate number are retained as aliases. No fuzzy matching or surname-only matching is used.

For a single reported age, the known election date defines a possible birth-date interval: `(election date − age − 1 year, election date − age]`. Intervals must overlap across the entire group, not just through successive pairs. Multiple inconsistent ages or missing age prevent a cross-election match. Every pair must be unique for its target election within the name bucket. Connected groups containing multiple candidate IDs from the same election or no shared birth interval are split back into separate profiles.

Municipality metadata can be from a municipal candidacy or an explicit residence field. A regional/riksdag constituency alone is not a municipality. Historical gaps, moves, changed names and missing ages can split a real person into multiple profiles. The UI explains this and labels linked histories as calculated. Do not imply that all people have been exhaustively identified, or label someone a political newcomer based on an absent match.

Identifiers such as `p2014-430402` derive from the earliest joined source identity. Future imports must preserve existing profile links through aliases whenever added years or new identity evidence merge groups or change the earliest anchor.

## Changes

The comparison is the same election type and area, exactly four years earlier, for the linked person, including a different party. More than one party candidacy in either comparison year prevents an unambiguous comparison.

- Vote delta = current personal votes − previous personal votes.
- Relative change (%) = delta / previous personal votes × 100.
- Personal-vote share (%) = personal votes / that party’s **entire valid vote count** in the area × 100.
- Share-point change = current share − previous share, in percentage points.

No intermediate rounding. Formatting happens in the UI. Missing prior results produce null changes, never a zero baseline. A verified zero baseline has an absolute change but no relative percentage, and cannot enter the percentage leaderboard. Both counts are visible. A minimum prior-vote filter (default 1, selectable 0/1/10/50/100) is explicit. Change leaderboards contain positive changes only. Total-vote rankings also include zero observations when present. Equal unrounded values have shared competition ranks (1, 2, 2, 4), with deterministic name/area/person ordering within ties.

Riksdag comparisons require exactly the same constituent municipality-code set from the two sources. For example, Västra Götaland south changed between 2014 and 2018: the raw counts are shown but their delta is withheld. The 2018–2022 membership matches. Municipal/region comparisons use the whole administrative unit. Subregional constituency values remain available in the profile’s detail table without presumed comparability.

Local party-result arrows on the map use the selected election versus four years earlier, at national, county, municipal and verified district levels. District history continues to require the existing official comparison mapping. `OTHER` remains a combined party bucket in local Riksdag geography, while candidate rankings use actual individual party codes.

## Regression anchors

Lars Gustaf Andersson’s derived profile links `2014:430402`, `2018:112693`, `2022:46783`, independently of party. Riksdag constituency 19: 13 (FP/L, 2014), 43 (L, 2018), 102 (M, 2022). The comparable 2018–2022 change is +59 / +137.2093023255814%, but the share of party votes falls (denominators 7,624 and 26,846).

Borås KF: 109/4,270 in 2014; 281/5,261 in 2018; 179/13,382 in 2022, shown separately from Riksdag and RF. The 2018→2022 municipal change is −102 votes, not +59. Source name matches without enough identity evidence (including a separate 2010 source record) are not manually forced into this group.

Riksdag personal thresholds: 8% in 2010, 5% in 2014–2022. Reaching a threshold is not proof of being elected. Primary references: [SCB’s official 2010 results](https://www.scb.se/contentassets/b485269e93864392b0640b8b8c6b1c28/me0104_2010a01_br_me01br1101.pdf) and [Riksdag KU13, historical reform](https://data.riksdagen.se/dokument/H301KU13).

## Validation

The import reconciles ballot-list counts with direct candidate aggregates and party personal totals. The build verifies checksums, source coverage (29 RD constituencies, 290 municipalities, 20 regions), national personal-vote sums, unique scoped candidate observations and valid party denominators. Tests preserve every existing 2022 RD observation and exercise ambiguous names/ages, same-number collisions, zero/missing baselines, party changes, area changes, re-runs, ties, filtering and public payload rejection. Forecast and live-result adapters are independent and unchanged.


## Leaderboard presentation and profile standings v1

Method: `candidate-leaderboards-1.0.0` (8 September 2026). Source normalization stays `candidate-history-1.0.2`.

- Default: most personal votes, latest imported election (currently 2022), municipal council. Existing explicit metric/filter URLs retain their meaning.
- Riksdag **total votes**: first filter year, county/constituency and actual party, then sum distinct `(person, party, constituency)` counts. One row per person and party; different parties are never merged. A selected single constituency reproduces the original result. Never sum across election types/years. Re-runs remain excluded. Duplicate observations fail closed. Source rows stay intact; each total exposes its constituent counts and printed ballot positions. No synthetic combined ballot position or percentage change is attached to the sum.
- **Support down the ballot**: an explicit exploratory subset, not an estimate of political competence or a causal adjustment. At least 100 personal votes; nonempty printed positions; every position reported in the result must be 6 or lower on the ballot (numerically >=6). Rank by personal votes / all valid votes for the actual party in that area. No historical match is required. A candidate reported at positions 1 and 20 does not qualify; absent positions do not qualify. `lists` counts source observations and cannot measure completeness against the deduplicated `ballotPositions` array. Other registered ballots may be absent from the source. The 100-vote and position-6 cutoffs are editorial choices made explicit beside the results. The ratio still varies with party size, geography, name recognition and campaign; it is not a residual performance score.
- Other change rankings retain the existing eligibility and formulas. Shares and changes are not added across Riksdag constituencies.
- `buildStandings` runs the same `candidateLeaderboard` function as the browser, before clipping at rank 100, for nation/county/area and all-parties/actual-party cohorts. Region and county coincide for RF, so the redundant county column is omitted. Competition ties, full cohort counts, year, election, source party and area stay attached. RD total ranks are linked to each contributing constituency profile; all other ranks refer to that constituency’s observation.
- Compact `standings-v1/{shard}.json` payloads are DERIVED and carry the leaderboard method plus the source version. The profile rejects invalid/stale versions, duplicate scopes, ranks outside 1–100 and totals smaller than rank. A failed download has a retry state, not a claim of no achievements. Empty arrays mean no qualifying top-100 entry. Profile year and peer filters remain visible.
- Owner-confirmed display thresholds: ranks 1–49 exact; rank 50 is `Topp 50`; ranks 51–100 `Topp 100`. Ties retain their earned competition rank. Each link includes the exact election, geography, party, metric, minimum-prior-votes=1 and person. The leaderboard computes the full cohort before showing that person; clearing the person filter restores the full list.
- Percentage labels abbreviate large numbers (`13 400,0 %` → `13,4t %`; English `13.4k %`) with the full formatted value in the accessible label/title. Numbers in calculations, downloads and sorting are never abbreviated or rounded.

Regression coverage reconciles nationwide and county Riksdag totals with original observations, ties and duplicate rejection; checks down-ballot thresholds/multiple positions/missing metadata; and matches real profile standing links back to the complete live-view ranking algorithm across years, scopes and party changes.
