# Swedish election forecast v1 beta

Classification: **MODEL**

Model ID: `pv-election-forecast`

Version: `1.0.0-beta.1`

Election: Swedish Riksdag, 2026-09-13

The forecast estimates vote shares, mandates and the frequency of precisely resolved parliamentary outcomes. It is not an official result, a betting market, a poll or a statement that a particular government will be formed.

## Plain-language interpretation

Politicalverse first combines recent national polls into one polling average. It then asks how wrong comparable pre-election polling has historically been, creates 10,000 plausible national results around the current average and sends every result through the same 29-constituency Riksdag mandate engine used by the scenario simulator.

A displayed probability is the share of those 10,000 model runs in which the stated resolution condition was met. An 80% interval spans the 10th through 90th percentiles of the simulated outcomes. Neither is a guarantee.

## Frozen polling average

The beta configuration is frozen at a **180-day window** and a **28-day exponential half-life**. For v1 these are fixed design choices assessed against the 2010, 2014 and 2018 election replays; the repository does not claim to reproduce an exhaustive hyperparameter search. The 2022 election was then evaluated as a locked holdout and was not used to alter the 180/28 parameters.

For an observation to enter an as-of-date average it must:

- have a publication date on or before the cutoff, preventing unpublished future observations from leaking into a historical replay;
- contain all eight current parliamentary-party estimates;
- have a usable measurement date no more than 180 days before the cutoff.

Recency is measured from the midpoint between exact fieldwork start and end dates. If fieldwork is marked approximate, missing or reversed, the model falls back to publication date; reversed exact dates are also rejected by the input validator. Approximate fieldwork receives a `0.85` weight multiplier.

Each eligible poll receives:

```text
weight = 2^(-age in days / 28)
       × clamp(sqrt(sample size / 1,500), 0.55, 2.5)
       × fieldwork-quality multiplier
```

A missing or unusable sample size gets neutral sample weight `1`. After raw weights are calculated, one polling house is capped at **25% of total weight** whenever that cap is mathematically possible given the number of houses. This prevents a high-frequency house from dominating without claiming that Politicalverse has estimated a separate house-effect correction.

The eight party means and the residual `OTHER` category are normalized together to 100%. `OTHER` keeps the probability vector exhaustive, but v1 treats it as an aggregate that is **not seat-eligible**: it does not model a specific new party clearing 4% nationally or 12% in a constituency. Every one of the 349 simulated mandates is therefore allocated among the eight named current Riksdag parties. This assumption is exposed in the normalized model metadata and UI. Evidence fields expose raw poll/house counts, Kish effective poll and house counts, the largest realized house weight, approximate-date count and the sum of reported sample sizes. That sample-size sum is explicitly non-unique.

## Historical calibration and holdout

For every historical replay the cutoff is the same number of days before election day as the current 2026 run. Only polls published by that historical cutoff are visible.

| Election | Role in v1 beta | Eight-party comparability |
| --- | --- | --- |
| 2002 | coverage audit only | Excluded |
| 2006 | coverage audit only | Excluded |
| 2010 | configuration assessment | Included |
| 2014 | configuration assessment | Included |
| 2018 | configuration assessment | Included |
| 2022 | locked holdout | Included |

The 2002 and 2006 official election results remain part of Politicalverse's six-election `OFFICIAL` history. They are excluded from the modern model because the polling rows do not separately and completely represent today's eight-party taxonomy. Missing SD values are not imputed as zero. The comparable forecast audit therefore contains four elections and 32 party-election outcomes.

The product reports calibration error for 2010–2018, locked holdout error for 2022 and combined descriptive error for all four comparable elections. After the frozen configuration has been evaluated, all four residual vectors—including the already scored 2022 holdout—inform the production uncertainty estimate. This does not retroactively tune the 180/28 average, but it does mean 2022 is part of the final error distribution.

## Uncertainty model

Uncertainty is estimated across nine jointly exhaustive categories: the eight parties plus `OTHER`.

1. Calculate poll-average errors for the four comparable elections at matched horizons.
2. Build their residual covariance matrix.
3. Shrink off-diagonal covariance by 65% toward zero, retaining 35% of the observed cross-party covariance because four elections are a very small sample.
4. Add current polling disagreement divided by effective poll count to each party's diagonal variance, with a minimum historical standard deviation of 0.55 percentage points.
5. Use leave-one-election-out residual diagnostics to scale the matrix toward empirical 80% interval coverage; expose both the measured coverage and applied scale.
6. Draw heavy-tailed multivariate shocks with a variance-adjusted Student-t distribution with five degrees of freedom.

The model runs **10,000 deterministic simulations** as antithetic pairs: every sampled shock is also run with its sign reversed. This reduces Monte Carlo noise around the same center without pretending the error distribution is symmetric in its political consequences. Small negative raw shares are floored, all nine categories are renormalized to 100%, and every run is projected to mandates.

The committed seed makes the snapshot reproducible. A source checksum, source commit, model version, cutoff or seed change produces a different snapshot ID.

## Exact mandate projection

Each national simulated result is sent through `riksdag-2026-v1.0.0`, the separately tested Swedish mandate engine:

- the official 2026 distribution of 310 fixed seats across all 29 constituencies;
- 39 national adjustment seats;
- the 4% national and 12% constituency thresholds;
- the modified odd-numbers method and fixed-seat return rules;
- each party's official 2022 constituency pattern as the disclosed geographic projection assumption.

The engine exactly reproduces each parliamentary party's official fixed, adjustment and total mandates for both 2018 and 2022. The forecast still cannot know the real 2026 constituency pattern, so exact electoral-law arithmetic does not make its inputs exact.

Swedish law resolves an exactly equal comparison figure by lot. Politicalverse uses a per-simulation **seeded lottning (tie draw)** so the Monte Carlo result remains reproducible and does not privilege permanent registry order. The normalized output reports how many simulations invoked a seeded lottning. It does not claim to predict the result of a future official drawing of lots. When the reusable base engine is called without `tieSeed`, it retains a stable-order fallback for deterministic historical backtests; forecast generation always supplies the seed.

## Prediction questions and government formation

Every question has a literal resolution rule. Examples include reaching 175 mandates, crossing the 4% threshold, becoming the largest modeled party or one named party receiving more mandates than another. Question probabilities are mandate/vote outcome frequencies, not market prices.

Political material uses separate classifications:

- `POLL` — an opinion-survey observation;
- `MODEL` — a Politicalverse estimate, interval, mandate projection or probability;
- `DECLARED` — a dated public position from a party or leader;
- `CONTEXT` — constitutional rules or sourced explanatory background.

Coalition probabilities answer only whether the named parties reach at least 175 seats in a run. Sweden's negative parliamentarism means a prime-minister candidate can be tolerated without 175 affirmative votes, and public coalition conditions can conflict. Politicalverse therefore does **not** convert coalition arithmetic into a probability that a particular government takes office.

There are no odds for named future ministers, individual cabinet posts, party-leader replacement or other person-level events in v1. The prime minister appoints ministers after the parliamentary process, and the current data/model do not support defensible person probabilities. The site may show sourced `DECLARED` positions and `CONTEXT`, clearly separated from the forecast.

## Limitations

- Four comparable elections are a thin basis for estimating a nine-category error distribution. Reported precision is computational, not evidential certainty.
- The average caps house influence but does not estimate pollster-specific house effects, mode effects or undecided-voter flows.
- SwedishPolls is a CC0 aggregation with known historical coverage and rounding limitations; its rows are `POLL`, not official results.
- The model uses national polls and a 2022 geographic pattern. It is not an MRP model and does not directly use municipality demographics, campaign events, turnout shifts, tactical voting or candidate effects.
- `OTHER` is a residual uncertainty category, not a modeled new party, and receives no seats even when the aggregate draw is large.
- Polling errors and political conditions can change in ways absent from 2010–2022.
- A mandate majority is neither a confidence vote nor a negotiated coalition agreement.
- Probabilities can move sharply when a party is close to 4%, even if its average changes only slightly.

## Reproduction and integrity

```bash
npm run data:forecast:generate
npm run data:verify
npm run check
```

The source manifest pins the raw CSV SHA-256, upstream commit, accepted row count, cutoff, three primary cross-checks and normalized forecast SHA-256. Calendar dates are round-trip validated rather than accepted through JavaScript date rollover; future Swedish dates and cutoffs after election day are rejected. The six-hour refresh workflow fails closed, becomes a no-op after election day and keeps the last-known-good snapshot when the source or model fails validation. See [`opinion-polls.md`](../data-sources/opinion-polls.md) for the ingestion and quarantine contract and [`simulator-v1.md`](simulator-v1.md) for the mandate engine.

## Version history

- `1.0.0-beta.1` — frozen 180-day/28-day polling average assessed on 2010–2018; locked 2022 holdout; nine-category shrunk covariance with seat-ineligible aggregate `OTHER`; leave-one-election-out interval scaling; 10,000 antithetic heavy-tail simulations; exact 29-constituency mandate projection with seeded lottningar.
