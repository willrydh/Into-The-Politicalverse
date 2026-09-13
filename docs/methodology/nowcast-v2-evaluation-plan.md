# Nowcast v2 evaluation plan — 13 September 2026

Owner request: make a serious attempt to improve early election-night predictions. This is Politicalverse's work, not an official OpenAI or SVT forecast. Model size/name is not evidence of predictive accuracy.

Before inspecting v2 results, the development plan is fixed as follows:

- Preserve all signed-source checks and observed votes. Keep the running production collector on the accepted version until a replacement passes validation.
- Compare the existing national matched-swing estimator with regularized district-swing regression and partially pooled geographic residuals. Predictors may use historical party composition, electoral-roll size and historical valid-vote participation. Do not label electoral proxies as measured demographic data.
- Select regularization using held-out municipalities among the districts already reported at each checkpoint. Unreported current-election outcomes may not enter training, scaling, model selection or readiness diagnostics. Keep a national-swing fallback and an explicit extrapolation diagnostic.
- Extend official historical inputs with the authority's 2014–2018 comparison mapping, if it can be reconciled. Evaluate both 2018 and 2022, separating development evidence from independent prospective evidence. Previously examined 2022 results cannot become an untouched holdout by renaming them.
- Report identical-input comparisons at 1%, 2%, 5%, 10%, 20%, 50%, 80% and complete coverage, using synthetic size, party-composition and geographic orders plus seeded interleaved orders. Report party MAE, bloc error, worst errors and which orders get worse. These are not actual reporting-time replays unless original reporting timestamps and their meaning are verified.
- Earlier numerical output requires verified comparability, effective sample size, municipal/constituency spread and bounded covariate extrapolation. Never obtain earlier output just by hiding failed diagnostics.
- Keep probability accuracy explicitly unvalidated. Sensitivity ranges must include between-model and geographic uncertainty; neither intervals nor simulation frequencies gain calibration through a more complex estimator.
- Preserve timestamped 2026 source/model snapshots so forecast errors can be evaluated against data that arrived later. Do not overwrite the frozen pre-election polling reference.

No claim to outperform SVT is justified without matched timestamped forecasts and outcomes.
