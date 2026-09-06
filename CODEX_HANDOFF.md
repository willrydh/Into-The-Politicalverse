# Codex takeover brief — Into The Politicalverse

## Mission

Continue **Into The Politicalverse** as a production-quality quantitative election intelligence platform. Sweden and the 2026 Riksdag election are the first live cycle. `README.md` remains the canonical product specification.

The product is public, source-traceable and data-first: official results, geography, historical patterns, reproducible indicators, deterministic scenarios and a clearly separated probabilistic forecast. It is not a betting service, news site, party recommendation engine or official government service.

## Implementation checkpoint — 2026-09-06

Public repository: `willrydh/Into-The-Politicalverse`

Canonical/public branch: `main`

Scoped development branches: `codex/*`

Public release: `https://willrydh.github.io/Into-The-Politicalverse/`

The original public foundation remains intact:

- Next.js 16 + TypeScript application and responsive Riksdag-inspired visual system;
- official final national Riksdag history for 2002–2022;
- verified Valmyndigheten national, constituency and municipality ingestion;
- all 29 constituencies, 290 municipalities and 6,578 2022 electoral districts;
- checksum-pinned 2018 municipality comparison and 2018–2022 map swing;
- official local party identities and recorded asset provenance;
- Party Explorer, charts, maps, elections and four deterministic indicators;
- independent Swedish mandate engine using the official 2026 fixed-seat structure;
- exact fixed, adjustment and total mandate backtests for 2018 and 2022;
- static read-only data endpoints, CI and GitHub Pages deployment;
- fail-closed local runtime isolation at `127.0.0.1:4317`.

The prediction layer adds:

- the tracked CC0 SwedishPolls bank with immutable upstream commit, row count, cutoff, SHA-256 and normalized-output checksum;
- exact recent primary cross-checks against Novus, Verian/SVT, SCB, Demoskop and Indikator;
- a frozen `pv-election-forecast` `1.0.0-beta.1` model;
- vote and mandate distributions, threshold/largest-party questions and named coalition mandate arithmetic;
- 10,000 deterministic antithetic heavy-tail simulations through the exact 29-constituency seat engine;
- explicit calibration, holdout, uncertainty and seeded-tie diagnostics;
- sourced government-formation `DECLARED`/`CONTEXT` separate from `MODEL` output;
- a scheduled six-hour fail-closed source refresh that commits only accepted data to `main`, then builds and deploys that exact accepted commit through GitHub Pages.

## September maintenance

The shared header is sticky with direction-based visibility: it hides on downward scrolling, reappears on upward scrolling and remains accessible to keyboard focus. Its localized location trail identifies every site page and receives verified geographic names from the local explorer through `SiteLocationProvider`; stale route/query entries are ignored. Preserve active-page semantics, mobile menu centering, reduced-motion behavior and the measured header offset for in-page navigation.

The local explorer release expands `/maps/` and `/en/maps/` to county → municipality → electoral district. Four official elections (2010, 2014, 2018, 2022) cover 21 counties and 290 municipalities; 6,264 physical 2022 district geometries have 4,162 verified 2018 histories. Keep the 2,100 changed districts and two shared-baseline cases unavailable instead of inventing swing. Four blank workbook district names are filled from the exact-code official 2022 GIS source and recorded in the local manifest.

Collection votes, including late overseas votes, contribute once to municipality/county/national totals. They are grouped per municipality, have no map polygons or separate electorate, and are not exclusively overseas votes. Personal-vote tables contain 1,457,836 final 2022 RD votes, aggregated across ballot lists within candidate/party/constituency. They always name the whole Riksdag constituency; the source does not expose municipal/district personal-vote counts. Preserve actual minor-party denominators, rather than using the aggregated OTHER category for candidate shares. See `docs/data-sources/local-election-geography.md`.

Local JSON endpoints end in `.json` for GitHub Pages. Detail payloads are loaded on demand, validate sums against the municipal index, and cannot show stale data under a newly selected place. URL parameters and browser back/forward retain selection, including language changes. Import commands: `data:import:local` and `data:import:personal`. Source/output checksums and all new geography/personal-vote invariants are part of `data:verify`. This release is historical Riksdag geography, separate from municipal council elections and the 2026 live feed.

The bilingual election-night release adds Swedish default routes and `/en/` equivalents, including all interactive tool copy. Keep source identifiers and statistical data language-independent. Server pages call `localizeNode` before serialization; interactive components use `LocaleProvider` and `Localize`. Do not rely on a client wrapper to traverse deferred server-component children after hydration.

Official live data is independent of the forecast: signed preliminary and final-count adapters, early-voting CSV, reviewed preparation files, and a dedicated `live-data` branch. Both official rehearsals verify, but actual production results are still unpublished before election day. See `docs/operations/election-night-2026.md` and `docs/methodology/election-night-v1.md`. Never merge the orphan data branch into `main` or replace historical 2022 geography with 2026 boundaries. The static `live-baseline.json` endpoint is a build-time fallback; the raw `live-data/election-2026.json` URL is the live feed.

The fixed 19 August historical poll counts were blocking valid refreshes. Tests and `data:verify` now validate the frozen year/role split plus date-matched counts and houses, with a regression across 19 August and 4 September. Do not reintroduce counts tied to a single snapshot.

`lib/forecast/source-corrections.ts` holds reviewed primary-source publication-date corrections. Adapter version and correction provenance are included in the public forecast and snapshot identity; unchanged upstream bytes must still regenerate when this policy changes. Novus's September date is corrected from 1 to 2 September without modifying source bytes. The 180/28 model remains frozen.

The home and forecast pages display data age in the browser, warn after seven days, and label post-election snapshots as archived. The government context was reviewed on 6 September, with a current KD rejection of Andersson and clearer C conditions. Official 2018/2022 sources and the 2026 fixed-seat workbook were re-fetched and matched their saved checksums. See `docs/data-sources/source-review-2026-09-06.md`.

## Classification contract

Never present an unexplained number or claim. Use these labels deliberately:

- `OFFICIAL` — authoritative source observations, primarily Valmyndigheten or SCB;
- `POLL` — an opinion-survey observation;
- `DERIVED` — deterministic Politicalverse calculation from identified inputs;
- `MODEL` — estimate, probability, interval, forecast or scenario;
- `DECLARED` — dated public position attributed to a party or leader;
- `CONTEXT` — constitutional rule or sourced explanatory background.

`POLL` is not `OFFICIAL`. `DECLARED` is not a prediction. `CONTEXT` is not a probability. Coalition mandate probability is not government-formation probability.

## Forecast v1 beta contract

Do not silently change these choices:

- 180-day eligible-poll window;
- 28-day exponential half-life;
- fieldwork-midpoint recency, falling back to publication date for approximate/missing fieldwork;
- publication date at or before each cutoff, preventing historical lookahead;
- sample weighting and 0.85 approximate-fieldwork multiplier;
- maximum 25% weight for one polling house when mathematically feasible;
- 2010, 2014 and 2018 for configuration calibration;
- 2022 as the locked holdout, not used to select 180/28;
- exclusion of 2002/2006 from the modern eight-party model instead of imputing missing SD as zero;
- eight parties plus `OTHER` as the nine-category uncertainty system;
- shrunk residual covariance, leave-one-election-out interval scaling and Student-t heavy tails;
- 10,000 antithetic runs with a committed seed;
- exact 29-constituency mandate calculation using the official 2026 fixed-seat structure and disclosed 2022 geographic-pattern assumption;
- seeded, reproducible lottningar for exact quotient ties in forecast runs, with occurrence count/rate exposed.

The base seat engine can retain stable-order fallback when no `tieSeed` is supplied so historical backtests remain deterministic. Forecast generation always supplies a seed. Changing any model item requires a new model/method version, regenerated data, tests and synchronized methodology documentation. See `docs/methodology/forecast-v1.md`.

## Poll-data contract

The accepted source snapshot is:

- `data/raw/polls/SwedishPolls.csv`;
- `data/raw/polls/source-manifest.json`;
- normalized output `data/normalized/election-forecast-2026.json`.

`npm run data:polls:update` must fail closed. It discovers the latest `Data/Polls.csv` commit on SwedishPolls `master`, fetches the immutable commit and current master copy, validates them before generation, and replaces the three tracked artifacts only through same-directory temporary files and atomic renames. Validation includes:

- exact header/schema;
- non-shrinking row count;
- non-regressing publication and commit dates;
- complete latest and recent modern polls;
- duplicate, strict calendar-date, Swedish present-day/election-day, sample-size, party-range and total checks;
- the manifest's primary cross-checks;
- raw and normalized SHA-256 values;
- a successful full forecast generation.

On any failure, the last-known-good files remain. After election day the updater retains the final pre-election snapshot without contacting upstream; forecast generation also rejects post-election cutoffs independently. The scheduled workflow runs `data:verify` and the complete repository check before it may commit. A `GITHUB_TOKEN` push does not trigger the separate Pages workflow, so a changed run checks out its emitted commit SHA, repeats the Pages verification/build gates and deploys that artifact itself. It does not deploy unchanged runs and refuses deployment if `main` has advanced beyond the accepted SHA. No personal token is required, and no poll refresh may update government context automatically. See `docs/data-sources/opinion-polls.md`.

## Government-formation boundary

The machine-readable context registry is `data/context/government-formation-2026.json`. Every time-sensitive statement needs an attributable URL, publication/effective date where available and `checkedAt`.

Swedish negative parliamentarism means 175 no votes reject a prime-minister proposal; 175 yes votes are not required. The prime minister appoints ministers after the parliamentary process. Politicalverse v1 therefore publishes no person, future-minister, cabinet-post or party-leader-replacement odds. Exact coalition sums can be modeled; negotiated government composition cannot be inferred from them.

See `docs/data-sources/government-formation-2026.md`.

## Other data invariants

- Valmyndigheten is the primary authority for official Swedish election data.
- SCB PxWeb is the primary authority for aggregate demographic and socioeconomic context.
- The intentionally untracked Valmyndigheten workbook is regenerated with `npm run data:import`.
- Preserve official source URLs, dates, expected totals and checksums in the Valmyndigheten manifests.
- Never combine 2022 election results with silently substituted 2026 geography.
- Keep the canonical party registry in `lib/parties.ts`; source-name mappings belong in adapters.
- Do not replace local party artwork without updating `docs/data-sources/party-assets.md` and hashes.
- Version indicators and keep `docs/methodology/indicators-v1.md` synchronized.
- Version simulator rules and keep `docs/methodology/simulator-v1.md` synchronized.
- Source adapters, canonical models, calculation engines and UI remain separate.

## Local and release isolation

Run the development server only with:

```bash
npm run dev
```

The preflight permits only `main`, the legacy `agent/foundation` branch and scoped `codex/*` branches in this exact repository/remote. It also requires repository root, fixed `127.0.0.1:4317`, a free port and no local tunnel/service route to that port.

Never modify other repositories, radio files/services, launchd jobs, tunnels, DNS, Cloudflare configuration or unrelated domains while working on Politicalverse. The only release target is this repository's GitHub Pages site. Browser QA must use a new temporary tab at the fixed loopback URL or Politicalverse Pages URL and close it afterward.

## Verification

Before handoff or publication:

```bash
npm run data:verify
npm run check
npm run build:pages
```

For an accepted source refresh:

```bash
npm run data:polls:update
npm run data:verify
npm run check
```

Report `implemented`, `tested`, `pushed`, `published` and `live-verified` separately. A local build is not a public release.

## Next priorities

1. Keep the forecast source, scheduled refresh and Pages gates healthy; quarantine unexpected upstream changes.
2. Preserve dated forecast snapshots so movements and final scoring can be audited without rewriting history.
3. Add official 2026 Valmyndigheten adapters as sources become available, preserving preliminary and final states.
4. Score forecast questions and vote/mandate distributions against the final official result.
5. Expand parameterized charts, municipal intelligence and SCB context with explicit provenance.
6. Add new prediction categories only when inputs, resolution, uncertainty and backtest are defensible.
7. Keep auth, billing and paywall outside the data engine and secondary to public analytical value.

Do not rewrite the existing architecture without a demonstrated defect. This file is the operational brief; when behavior changes, update it and `README.md` deliberately.
