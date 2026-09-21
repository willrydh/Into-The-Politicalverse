# Final personal votes and current results, 2026

Reviewed 21 September 2026. Source: [Valmyndigheten’s 2026 raw data](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026), its production index and signed result archives. The accepted generation is pinned in `data/raw/valmyndigheten-2026/candidate-source-manifest.json`; do not copy these point-in-time counts into evergreen UI text.

## Accepted coverage

The Riksdag final archive, revision 860, was updated 19 September at 12:53:03 UTC. All 6,626 districts, 29 constituencies, 349 mandates and the published protocol are present. It contains 6,767,429 valid votes and 1,637,668 personal votes: 13,269 candidate/party/constituency observations and 6,042 candidate identities. The first import adds 1,844 profiles and links 4,198 identities to historical profiles. Every one of the 207,104 historical source identities retains its published profile URL.

The same index contains 33 municipal final-count archives, but none yet has the full establishment contract (complete count, mandates and protocol). No regional final-count archive is published. These ongoing results remain available in the live result views; they are not promoted to final personal-vote histories. Coverage labels distinguish unpublished, ongoing and established areas. Missing 2026 personal results never become zero votes or a fictitious decline from 2022.

## Import and verification

Run `npm run data:import:candidates:2026`. `candidate-2026-1.0.0` downloads the production index, checks exact election identities, MD5 ZIP checksums, the pinned signing certificate, RSA signatures and current-result arithmetic. It accepts only established areas. Each candidate’s personal votes are summed across the party’s distinct ballot lists and reconciled exactly to `summeradePersonroster`. Those two representations are never added together. Printed positions use `kandidatNummerPaListan`; zero means no known printed position. Blank party ballots need no candidate rows. Party vote denominators come from the same signed area.

`kandidaturer.csv` supplies names, age on election day and municipality evidence, never vote totals. The parser supports quoted multiline fields and literal quote characters in unquoted source fields. Raw signed JSON, signatures, CSV, index, provenance and normalized output have pinned hashes. `npm run data:verify` verifies signatures offline, requires established results again and reproduces the candidate observations from the retained originals.

The reviewed 2026 preparation district register supplies actual constituency municipality membership. All 29 membership sets match the previous 2022 sets; comparisons still compare the literal keys instead of assuming this in later elections. Municipal and regional 2026 personal observations use the official administrative aggregate, once per area. Subconstituencies are not invented when that source file contains only the aggregate.

`candidate-history-1.1.0` extends existing identity groups. Full normalized name, compatible birth-date interval inferred from source ages, common municipality and unique matching in both directions are required. An incoming identity cannot merge or split old groups. Ambiguity remains separate. Party switching is recorded as a candidacy change, not a claim about membership dates.

## Presentation

The default leaderboard is the latest year, Riksdag, most personal votes. Explicit historical URLs retain their election/year selection. A Riksdag total is one candidate/party row with expandable constituency observations. Shares and changes remain area-specific. All five metrics include 2026 and use the adjacent 2022 result only where identity and geography agree.

Profiles and sharing cards default to the most recent available election, preferring municipal only when equally recent. Explicit election/area selections remain respected. Historical rows descend from newest year; graphs remain chronological. Coverage notes explain when a profile’s latest linked observation is older than available 2026 results. National standings are produced only for complete national coverage, county standings only for complete counties, and local standings for each established area. Partial leaderboards identify their coverage.

The 2026 map/result view includes Riksdag constituency personal votes. It does not label these as municipal or district personal votes. Searches for municipalities and counties open current 2026 results; historical district polygons remain explicitly 2022. The new 2026 identities are searchable. Both languages, printed ballot positions, comparison notes, source manifests and social preview data use the same generation.

The sharing Worker must be released with the 2026 standings validator after the Pages data release. Future accepted areas within 2026 then update through normal data publication, without deploying the Worker again. Old image revisions redirect to the latest data revision; external social networks may retain their own cached previews.

## Automatic publication

If a candidate changes area between elections, a generic profile/share URL selects an area from their most recent election. Explicit historical area links remain valid and keep that chosen area.

`.github/workflows/candidate-refresh.yml` checks hourly in September and daily in October–December 2026; manual dispatch remains available. Only changed, verified data is committed. Signature/identity/coverage failures stop the update and preserve the published generation. A source correction needs a non-regressing source revision. Previously established sources cannot disappear or regress to unfinished status.

The job runs the complete data/release checks before pushing accepted data. Because a GITHUB_TOKEN commit does not trigger another workflow automatically, the refresh has its own Pages build, deploy and domain-health jobs. The exact accepted commit is built; a final main-branch guard prevents publishing stale work. The live count collector remains independent and publishes only its two existing live-data files. No DNS or private analytics changes are involved.

No-change detection compares decompressed, checksum-verified candidate content, so macOS/Linux gzip headers do not trigger redundant source generations. National comparison panels use the signed current archive's full-precision previous shares; rounded historical display percentages are never used as the subtraction baseline.

## Whole-platform transition and source exceptions

The homepage and chart page extend their national history and underlying table through the established 2026 result. All minor parties are summed once into the existing OTHER category. Source links point to the new protocol; the original 2002–2022 dataset remains untouched for historical model evaluation. Government comparison cards show actual group seat totals after establishment, with no residual simulation percentages or labels.

The homepage mandate bar and legend include only parties with seats; zero-seat registrations do not create empty segments or rows. The full vote table remains available through its expand control. Tests with current 2026 data read authoritative counts instead of freezing today's personal totals, so later official corrections can pass the same release gates.

Final national results replace current election-night projections on the forecast page and in the simulator. Old victory probabilities are withdrawn once an established result exists. The frozen pre-election reference and forecast scoring remain unchanged. The simulator accepts official constituency inputs only after independently reproducing each party’s fixed, adjustment and total mandates. Edited scenarios pin their starting source and are labelled MODEL; the untouched recalculation is DERIVED from OFFICIAL counts (scenario baseline version 1.2.0).

Count-indicator method `pv-count-indicators-1.1.0` uses fixed categories: the eight parliamentary parties and all remaining votes as a residual category in each election. Missing individual minor-party baselines are not assumed zero. Largest gains/losses refer to the eight named parties. Net volatility is half the sum of absolute changes across all nine categories; it does not identify individual voter movements.

Two signed final-count exceptions are retained as regression fixtures. Karlstad’s current votes reconcile, but the source’s previous party votes do not sum to its previous valid total: omit that comparison and show a source warning. Sorsele’s first counted district is an uppsamlingsdistrikt, 324 ballots with no electorate of its own: retain votes, display null turnout and a source warning. This exception requires a partial count, positive votes, zero counted electorate and the source’s zero turnout placeholder; the entire electorate remains an upper bound. Fully counted or otherwise malformed totals still fail. No source warning suppresses current-vote or signature validation.
