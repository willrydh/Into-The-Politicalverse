# Election-night projection v1

Politicalverse's independent `pv-nowcast-1.0.0` is an experimental **MODEL**, separate from official results and the frozen pre-election polling forecast. It estimates national valid-vote shares and a central seat allocation from the count in progress. It does not call a winner or report victory probabilities.

## Sources and scope

- Official 2022 final physical-district and collection votes: `data/normalized/local-election-districts.json`, with pinned workbook provenance.
- Official 2026 electoral roll, geography and comparability: `data/normalized/election-preparation-2026.json`. The universe contains 6,312 physical districts. Unique one-to-one or many-to-one predecessor sets teach the swing. Shared predecessors and non-comparable boundaries use the municipality's 2022 baseline and never teach the swing.
- The signed preliminary `rostfordelning_00_RD.json` in the same archive as the official mandate file. The [field specification](https://www.val.se/download/18.1a2972da19f159e73fd324b/1786558916266/prel-rostfordelning.md) is dated 14 April 2026. Collection extraction requires its own detached signature, the reviewed certificate and the archive MD5. Decompression is bounded to 128 MiB; at most 8,000 rows are accepted. Production identity, reporting times, unique geography, votes, electorate, counted districts and all constituency party totals must reconcile with the separately verified mandate file. A missing/ambiguous report flag or different source generations pauses the model.
- Method inspiration: [Vera Policy's published nowcasting article](https://www.nationalekonomi.se/artikel/nowcasting-pa-valnatten-metod-och-utvardering-fran-valprognos-se/) and [SVT's explanation](https://www.svt.se/nyheter/inrikes/senaste-nytt-om-val-2026?inlagg=9ddad0b9714e3b87fe4d3a2779e5552e). This is our implementation, not access to their code, model parameters, proprietary feeds or results.

The signed rehearsal vote-distribution archive was no longer available at the official URL on 13 September. National signed fixtures remain tested; the additional district adapter is tested against explicit synthetic schema examples. Actual production district-file compatibility remains a first-file verification gate. No rehearsal values may be shown as production projections.

## Calculation

For each counted comparable district, calculate the difference between current and historical party share. Average these differences using current valid votes as weights. For each unreported physical district, add that national swing to its historical share vector, clip negative values and renormalize to one. This assumes changes transport to the remaining districts; regional changes and non-random reporting can violate it.

Expected ordinary valid votes are historical valid votes multiplied by the current/historical electorate ratio. Fit a common volume multiplier from matched counted districts: current valid votes divided by their expected valid votes. Bound it to 0.5–1.5 and cap each ordinary district's prediction at its electorate. These are stability guards, not estimated confidence bounds. Municipality fallback rows use the municipality's historical share and valid-votes-per-elector rate.

Add counted votes without alteration. Only unreported districts are estimated. A higher official revision can decrease counts; rebuild deterministically rather than accumulating deltas.

Collection votes, including late and overseas ballots, are modeled separately from 2022 municipal collection totals, scaled by municipal electorate growth and the fitted volume multiplier. They do not add an electorate and are not all labelled overseas votes. When collection districts report, add actual counts and reduce that municipality's estimated remainder by the unreported share of its collection districts. This equal-size assumption within a municipality is provisional; where no collection rows exist yet, retain the whole historical estimate. At fully counted coverage the estimate equals the actual result. Final-count official results stay separate; this model is displayed only with the preliminary phase.

Before a numerical public projection, require 100 matched counted districts, eight represented constituencies, five percent of expected comparable baseline vote volume, and at least 70 percent of counted physical districts comparable. These are heuristic minimum-support gates, not guarantees of representativeness. Zero-data baseline estimates are not published.

Constituency predicted votes are rounded with a largest-remainder rule preserving each total. The existing independently backtested Swedish allocation engine applies the 2026 fixed-seat structure, 4%/12% thresholds and adjustment-seat rules. Seat output is withheld when the aggregate OTHER category could reach either threshold, because the engine represents only eight named parties. These are model seats, never official mandates.

## Sensitivity and historical checks

`npm run data:nowcast:verify` reproduces the checked-in stress report from 4,162 comparable 2018–2022 physical districts. Six deterministic reporting orders use prior electorate size, municipality order and prior left-party share in both directions. Targets include 1%, 5%, 10%, 20%, 50%, 80% and complete expected baseline vote exposure. Only the currently revealed 2022 outcomes enter each projection; the full outcome is used to evaluate error. Size uses the electoral roll, not future party votes. This is a calibration stress test on one election, not an independent temporal holdout or actual reporting-time replay. Changed boundaries and collection ballots are outside its evaluation population.

The displayed symmetric sensitivity half-width (percentage points) is the maximum of: the largest party-specific error across the six stress orders at the lower coverage checkpoint; twice the municipality-cluster swing standard error times projected remaining vote fraction; and a model-risk floor of one percentage point times remaining fraction plus one point times municipal-imputed share plus two points times estimated collection share. The cluster calculation uses municipality sums of vote-weighted residuals and a finite-cluster correction. Ranges are clipped to 0–100. At no remaining votes their width is zero.

These ranges are neither 80% nor 95% confidence intervals. They are marginal sensitivity ranges and their endpoints do not sum to 100. A geographically atypical sample can still fall outside them. No winner probabilities or mandate-probability intervals are inferred from these ranges.

## Delivery and failure isolation

The five-minute collector computes an optional compact `nowcast` envelope. It shares the national archive fetch but verifies the second JSON separately. Model failure publishes an unavailable state and warning while preserving validated official results and their independent status. A model envelope records its method, baseline/source SHA-256, archive MD5, source time/revision and calculation time. Browser validation checks it against the displayed official archive; incompatible/stale model envelopes cannot replace official counts. Numeric rows are withheld before minimum support.

A model/version or baseline change forces recomputation even when the archive is unchanged. Restart the running bounded watch after deployment so the new collector code is loaded. The pre-election reference, historical profiles, maps and leaderboards are unchanged.
