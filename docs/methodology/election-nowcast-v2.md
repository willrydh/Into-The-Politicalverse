# Politicalverse Nowcast 2

`pv-nowcast-2.0.0`, developed on 13 September 2026, estimates the uncounted part of the Swedish Riksdag election. It replaces the common national swing in v1 with a regularized geographic model, selected using only outcomes already reported. This is a serious statistical forecast under development, not an official OpenAI forecast or a claim to outperform SVT. Model labels and implementation effort are not evidence of accuracy.

The owner requested a stronger attempt at earlier and more accurate prediction. The [evaluation plan](nowcast-v2-evaluation-plan.md) was written before examining v2 results. Historical results were then used as development evidence. They are not a newly untouched holdout or probability calibration.

## Inputs and separation from official results

All [v1 source checks](election-nowcast-v1.md#sources-and-scope) remain: independent detached district signature, pinned certificate, archive MD5, production election identity, source time/revision, unique geography, and reconciliation with the mandate file for national and every constituency's votes/counts. The model cannot replace or block official results. The frozen pre-election polling forecast is unchanged.

The prediction universe remains the official 6,312 physical 2026 districts and separate municipal collection baselines. Only uniquely comparable historical predecessors teach change. Other boundaries use municipal history. Collection ballots, including late and overseas votes, are included once, estimated separately and replaced as they are counted. They are not all labelled overseas votes. The provisional equal-size reduction across a municipality's collection districts remains a limitation.

Current valid votes in a reported district are fixed in every point prediction and simulation. Current unreported votes never enter features, training, selection or readiness. Features can use updated electoral-roll sizes because these are known independently of an unreported voting outcome. A correction rebuilds the model from source snapshots; no incremental accumulation or cached fit survives a correction.

The additional production district adapter still has a first-real-file verification gate: the earlier signed rehearsal district archive was unavailable. Synthetic schema/invariant tests do not certify compatibility with a first production file. An incompatible file pauses only the model and retains verified official counts.

## Conditional district model

Ten historical predictors represent the eight named parties' shares, log district electorate and historical valid votes per eligible voter. These are electoral features, **not measured age, income, education or other SCB demographics**. Historical shares and electoral-roll sizes are available for the entire prediction universe. Feature scaling uses their expected vote-volume weights, with a 0.001 scale floor and standardized values bounded to ±8.

For a matched counted district, targets are its nine share changes (including OTHER) and the log change in valid-vote volume after electoral-roll growth. Vote-volume ratios are bounded to 0.5–1.5. Weight is current valid votes divided by the universe's average expected district vote volume, so regularization has units of equivalent districts.

Four folds are assigned deterministically by municipality. For each fold, entire municipalities are withheld; their current results are not used in fitting that fold. Candidates are a common national swing and ridge penalties 400, 100, 25 and 5. Weighted mean absolute share error for the eight named parties selects complexity, requiring a 2% improvement before moving from the current simpler candidate. Cross-validation needs at least 24 matched districts and 12 municipalities. Otherwise the national fallback remains. Selection uses feasible, nonnegative normalized shares, matching the production prediction operation. The live cross-validation score is a model-selection diagnostic, not an unbiased national-error estimate.

Ridge systems use Cholesky solves, an unpenalized weighted intercept and no external ML service. Effects for a new district are shrunk by `1/(1+leverage)`. County residuals are pooled with 40 equivalent districts of zero-effect support; municipal residuals, after the county effect, with 12. These are documented regularization choices, not independently calibrated causal parameters. The selected model estimates shares and turnout volume. Volume is capped at the unreported physical district's electorate. If national swing wins selection, the v1 common volume ratio and common share change are used.

All nine party shares are clipped at zero and normalized together. Summing observed plus estimated ballots gives constituency and national totals. The existing Swedish mandate engine applies the official 2026 fixed-seat structure and electoral rules. Aggregate OTHER crossing 4% nationally or 12% in a constituency withholds the central seat allocation because the engine represents eight named parties.

## Earlier publication with support checks

All of the following must hold before any numeric prediction or majority simulation is published:

- At least 50 matched reported physical districts and 1% of the expected comparable baseline vote volume.
- At least 20 municipalities and eight Riksdag constituencies.
- At least 40 effective districts, calculated as squared total vote weight divided by summed squared weights.
- At least 70% of reported ordinary districts have a verified historical match.
- A finite municipality-held-out score, and at most 25% of remaining expected physical vote volume requiring high-leverage extrapolation.

Extrapolation is measured independently of the chosen prediction penalty: center the historical feature vector on the reported weighted mean and calculate `x'(X'WX + I)^-1 x`. A value above one is flagged. The one-district reference penalty prevents stronger prediction regularization from concealing weak support. These are heuristic guardrails; they cannot establish representativeness of an unobserved outcome. Synthetic invariant tests explicitly include a large but compositionally narrow sample that fails publication.

This permits publication before the old five-percent threshold when evidence is sufficiently broad. It does not promise a forecast after the first 50 districts, at a particular clock time, or always at 1%. Below five percent the interface marks the evidence as early. Source errors, stale feeds and incompatible envelopes suppress model numbers.

## Historical evaluation

`npm run data:nowcast:import` reproduces a checksum-pinned evaluation dataset. Downloads remain untracked; source URLs, hashes, normalized dependencies and output hash are in `data/raw/valmyndigheten-2026/nowcast-evaluation-manifest.json`.

- 2018: 4,631 comparable physical districts linked to 2014 by official O/S mappings, requiring whole, uniquely used predecessors at 100%. All 2014 and 2018 municipal totals, including collection ballots, reconcile before selecting physical comparison rows. Observations are final 2018 counts; preliminary 2018 reporting snapshots were not recovered.
- 2022: 4,162 already verified comparable districts linked to 2018. Observations come from the authority's completed preliminary workbook. Final 2022 district results are retained as a separate evaluation target. The preliminary file has no original report times and 6,067 missing electoral-roll entries; official final-workbook electoral rolls supply those independently known covariates.
- The preliminary workbook's `Summa giltiga röster` includes its separately labelled unregistered-party ballots. Every row's published denominator is reconciled against the eight parties, other registered parties and that extra category. OTHER retains the residual, without redistributing it among the eight parties. This preliminary denominator is not silently substituted for the final count.

Each election uses twelve synthetic reporting orders: previous electorate ascending/descending, municipality ascending/descending, previous S+V+MP share ascending/descending, and six deterministic seeded orders combining previous size with geographic interleaving. Seeds and ordering variables do not use current unreported votes. Checkpoints are 1%, 2%, 5%, 10%, 20%, 50%, 80% and 100% of expected baseline vote exposure, not a reconstructed clock time.

The old national estimator and new model receive identical revealed observations. Mean absolute party-share error (MAE) averages the eight named parties; OTHER stays in all denominators. Bloc error uses the current S–V–MP–C grouping consistently, not a claim about historical governments. Both published and withheld cases are retained; reports list every order that regresses and separate the subset meeting support gates. At complete preliminary coverage the projection equals those observed votes exactly; disagreement with the later final count can remain.

Reproduction and results:

```sh
npm run data:nowcast:evaluate
npm run data:nowcast:verify
```

The full report is [`election-nowcast-evaluation.json`](../../data/normalized/election-nowcast-evaluation.json), with input and implementation hashes. Its compact [summary](../../data/normalized/election-nowcast-evaluation-summary.json) appears in the site's method disclosure. The [stress report](../../data/normalized/election-nowcast-stress.json) retains joint errors from all 24 election/order combinations. The old six-order [v1 report](../../data/normalized/election-nowcast-stress-v1.json) and `scripts/backtest-election-nowcast-v1.ts` remain reproducible.

These are 192 development scenarios across **two elections**, not 192 independent elections. Comparable districts exclude changed boundaries and collection votes, so the reported MAE is not a verified full-national 2026 error rate. File order is not report time. No matched timestamped SVT forecasts have been evaluated; comparisons with published Vera/SVT error numbers would use different inputs and are not justified.

## Sensitivity and majority simulation

The point forecast's symmetric sensitivity span retains v1's historical worst-case errors, municipality-cluster standard error and floors for remaining, imputed and collection votes. It additionally includes the remaining-volume-weighted difference between the adaptive and national estimators. It is a sensitivity range, not a confidence interval with established coverage.

`pv-nowcast-majority-2.0.0` runs 1,000 deterministic simulations. Victory still means at least 175 of 349 seats for S–V–MP–C or M–KD–SD–L, not government formation. Accuracy remains explicitly unvalidated next to the numbers.

- Joint share errors from 24 historical election/order combinations supply an uncentered second-moment national perturbation at the lower coverage checkpoint. Scenarios are not independent elections. A one-percentage-point remaining-vote normal noise floor is retained.
- A common normal coefficient multiplies the adaptive-versus-national disagreement vector, adding model-choice uncertainty.
- Each constituency receives four independently sampled, sign-randomized municipality-held-out residual vectors, averaged together. This preserves party covariance while allowing local effects; four-group averaging and independence between constituencies are modelling assumptions.
- Remaining turnout volume receives a bounded lognormal stress (0.7–1.3 times its estimate). Log standard deviation is the RMS of held-out municipal log-volume residuals, bounded to 0.03–0.15. One quarter of its variance is national and three quarters local. These floors, bounds, correlations and distribution shapes have not been independently calibrated.

Perturbed shares are clipped and normalized; observed votes remain untouched. Every draw uses the existing vote-preserving rounding and mandate engine. OTHER threshold crossings remain unresolved in the **original denominator** and are disclosed. Neither extra covariates nor more simulations establish probability calibration.

## Prospective 2026 audit and operation

The existing `live-data` publication history preserves each five-minute verified feed, including model version, source hash/revision/time, baseline hash, prediction, probability and calculation time. No new write path is required and the archive is never merged into `main`.

```sh
npm run data:nowcast:audit -- --fetch --output=/tmp/politicalverse-nowcast-audit-2026.json
```

The audit uses the first archived publication of each current-model/source/baseline identity. A partial count is never graded as final. It waits for a complete official final count and requires the prediction's archive commit to precede that outcome's source time. It reports party-share errors, projected/observed mandates and a single-election majority outcome score. The Brier score is withheld when simulations contain unresolved outcomes: unknown draws are not predictions that neither bloc wins. The score is not a calibration study. Repository commit times provide an audit trail, not independent third-party timestamp certification. Unsupported older model versions are excluded explicitly. Revisions to final results remain attributable to their exact official source.

Deploy the public client and model together, then restart only the bounded election watch from fresh `main`, following the [runbook](../operations/election-night-2026.md). Signature/data failures still retain official last-known-good results. The model's historical validation failure blocks releasing new code; it does not replace real result collection with simulated data.

## Primary references

- [Vera Policy's published matched-district method and evaluation](https://www.nationalekonomi.se/artikel/nowcasting-pa-valnatten-metod-och-utvardering-fran-valprognos-se/).
- [Vera Policy's description of its 2026 work with SVT](https://via.tt.se/pressmeddelande/4536522/han-blir-forst-i-sverige-med-att-veta-vart-valet-ar-pa-vag?lang=sv&publisherId=3240960). Its listed demographic predictors are not claimed as connected here.
- [Valmyndigheten's historical raw data](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022), [2018 statistics and boundary mappings](https://historik.val.se/val/val2018/statistik/index.html), [2014 statistics](https://historik.val.se/val/val2014/statistik/index.html).
