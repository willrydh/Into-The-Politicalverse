# Historical election outcomes

Version: `election-outcomes-1.0.0`. Reviewed on 7 September 2026. Scope: the six final Riksdag elections from 2002 through 2022.

The archive separates three questions: which individual party received the largest vote share, which documented party group received the most seats, and which government followed the election. It never infers the prime minister or cabinet from the largest party.

## Official seats and reproducibility

`data/context/election-outcomes.json` preserves each party's final allocated seats, source identity, retrieval date and the source checksum. The 2002–2018 entries were extracted and reviewed against all five tables in [Valmyndigheten's historical results](https://www.val.se/valresultat-och-statistik/riksdags--region--och-kommunval/tidigare-valresultat). The [official 2022 summary](https://www.val.se/valresultat-och-statistik/riksdags--region--och-kommunval/valresultat-2022) was also retrieved and every party's seats matched the existing final data. The downloaded HTML and intermediate tables remain ignored under `data/raw/downloads/archive/`.

This is a reviewed historical transcription, not an automatically refreshed government model. To revise it, inspect the official tables, preserve updated provenance, review the year-specific party groups and rerun `data:verify` and `check`. Existing national vote-share history, mandate-engine inputs, forecasts and live results are unchanged.

Party seats are **OFFICIAL**. A group's seat count and the cabinet parties' combined seats are **DERIVED** sums of those official integers. Every election must contain exactly 349 seats. Each party may belong to at most one comparison group, and all allocated seats must be covered. Missing seats, duplicate membership, unknown parties, invalid counts or unsourced government entries fail validation. The 2018/2022 party counts must also match the independently verified mandate-engine baselines.

Majority means at least 175 of 349 seats. A largest group below that threshold is labelled as having no bloc majority. A tie retains all joint leaders. A government's majority status counts only its cabinet parties, not its support or cooperation parties. The seat graphic uses a common 349-seat denominator and marks the same 175-seat threshold.

## Year-specific comparisons

| Election | S-led comparison | Centre-right comparison | Separately shown | Government following the election |
| --- | --- | --- | --- | --- |
| 2002 | S + V + MP: 191 | M + C + FP + KD: 158 | — | Göran Persson, S; 144 cabinet seats |
| 2006 | S + V + MP: 171 | Alliance: 178 | — | Fredrik Reinfeldt, M + C + FP + KD; 178 |
| 2010 | S + V + MP: 156 | Alliance: 173 | SD: 20 | Fredrik Reinfeldt, M + C + FP + KD; 173 |
| 2014 | S + V + MP: 159 | Alliance: 141 | SD: 49 | Stefan Löfven, S + MP; 138 |
| 2018 | S + V + MP: 144 | Alliance: 143 | SD: 62 | Stefan Löfven, S + MP; 116, from 21 January 2019 |
| 2022 | S + V + C + MP: 173 | Tidö parties, M + KD + L + SD: 176 | — | Ulf Kristersson, M + KD + L; 103 |

FP is the historical name of the party now registered as L. The 2002 centre-right parties are not retrospectively called the Alliance. SD is not added to the Alliance in 2010–2018. In 2022, S + V + C + MP is explicitly a comparison group rather than a shared cabinet.

Government composition and dates are sourced to [the Riksdag's government history](https://www.riksdagen.se/sv/sa-fungerar-riksdagen/demokrati/sa-bildas-regeringen/tidigare-regeringsbildningar-och-statsministrar/). The cabinet panel describes the first government following the election, including a continuing cabinet. Later changes during a term are outside this view; the 2018 row must not be relabelled as Magdalena Andersson's later 2021 government.

The [18 January 2019 parliamentary record](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/protokoll/protokoll-20181939-fredagen-den-18-januari_h60939/html/) explains the separate post-election agreement with C and L and V's abstention. These events do not retroactively move C/L into the election's S + V + MP comparison. [The government's November 2022 description](https://regeringen.se/artiklar/2022/11/regeringens-politiska-prioriteringar/) identifies SD as a cooperation party outside the M/KD/L cabinet. The source registry also retains the 2002 cooperation and 2006 Alliance government references.

These explanations are **CONTEXT**. The grouping is visible alongside every count, and each expandable source panel exposes the underlying party seats. Swedish and English pages render their respective text and number/date formats on the server. No unreviewed 2026 government outcome is inferred or displayed.

## Verification

Regression tests anchor all six bloc totals and governments, distinguish bloc and cabinet majorities, protect the 2018/2019 distinction, reject corrupt or overlapping allocations and retain ties without inventing a winner. Runtime data verification checks the full archive and its 2018/2022 cross-source agreement.

Release validation on 7 September 2026 passed `data:verify`, `check` (72 tests, lint, typecheck and production build) and `build:pages`. Both exported language pages contain all six outcomes and the correct Pages asset paths. Browser checks covered English/Swedish output, all bloc/cabinet totals, 390/768/1280-pixel layouts, year anchors, keyboard-operated source details, the 175-seat chart markers and the scroll-aware menu. No browser errors or page-width overflow were observed.
