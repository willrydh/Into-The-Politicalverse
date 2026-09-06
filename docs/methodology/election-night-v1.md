# Election-night presentation v1

## Quantities and denominators

- Party share = party valid votes / all valid votes × 100. Invalid votes are excluded from this denominator.
- Turnout in counted districts = all ballots / eligible voters in those counted districts × 100. It is not the forecast electorate or the national qualification-day count.
- Reporting progress = counted districts / districts scheduled for this counting stage. It does not estimate the percentage of all votes counted. District sizes differ and early districts are not a representative sample.
- Advance-voting totals describe received ballots. They are not party votes, final turnout, or extra ballots to add to an election result.
- Zero coverage yields unknown percentages and unknown mandates, displayed as a dash. It is not a zero-percent result.

Every area reconciles valid + invalid = total, party + other = valid, and counted ≤ scheduled districts. The 29 constituency vote, eligibility and district totals reconcile to national totals. When constituency mandates are available, fixed/adjustment/total seats reconcile to national allocations. Source percentages are cross-checked against the correct denominator with tolerance for published rounding.

## Official mandates and the independent engine

Valmyndigheten's published allocations remain authoritative. The adapter checks 349 total seats, 310 fixed seats, 39 adjustment seats, the national 4% threshold, the 12% constituency rule and the reviewed 2026 fixed-seat structure in all 29 constituencies. The independent modified Sainte-Laguë engine uses first divisor 1.2 and the existing fixed-seat return and adjustment rules.

The same engine exactly reproduces 2018/2022 historical official fixed, adjustment and total seats. Both signed 2026 rehearsals reproduce all three components for every represented party. A drawing of lots is necessary in the preliminary rehearsal; the authority's allocation is retained and the check is explicitly classified `official-lot`. If unequal results occur without any equal quotient, the snapshot is quarantined. When lots occur, the independent engine cannot certify the authority's particular draw; never label this as unconditional equivalence.

An additional named party crossing 4% nationally or 12% in a constituency makes the eight-party scenario engine inapplicable. Its official votes and seats remain in the result, under its original four-digit code; it is never folded into another party or silently dropped. Missing vote coverage/mandates also makes the independent check inapplicable. This does not replace official data with model output.

## Phases, corrections and timestamps

`preliminary` and `final-count` are stored independently because they can overlap. Final counting is not a certification signal. A source protocol may be linked; the UI does not infer legal certification from a phase name or 100% district coverage.

Source timestamps without offsets are interpreted in Europe/Stockholm, including daylight saving. Source revision and update time must not regress. A repeated revision cannot change JSON contents. Higher revisions may legitimately reduce votes or reported districts after corrections.

Production rejects rehearsal/test flags, wrong election dates, wrong counting stages and unsigned/unreviewed files. A failure retains the last verified snapshot for each phase and records degraded status. Early-voting collection is independent. The browser validates the public envelope and arithmetic again, rejects regressions and retains its previous accepted feed on network or validation failure.

## Separation from forecasts

The frozen 180-day/28-day-half-life forecast is unchanged. Official results do not retune its parameters, become polls or update its historical test set. Its 2010–2018 calibration and 2022 holdout remain unchanged; four historical elections cannot guarantee future calibration. The forecast view becomes explicitly archived after election day. Official results live on `/valnatt/` and `/en/valnatt/`.
