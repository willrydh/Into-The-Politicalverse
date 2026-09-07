# Into The Politicalverse

A shared light/dark palette is available from the header. The initial mode follows the system; an explicit choice persists across reloads and languages. Party colors and official logos retain their original identity.

> **Politics, quantified.**
>
> A source-traceable quantitative election intelligence platform for exploring elections through official results, geography, historical patterns, transparent indicators, polling models and scenario simulation.

## Master project specification

The public UI is available in Swedish at the existing routes and English under `/en/`, with a same-page language switch. Official 2026 counting has its own `/valnatt/` view, independently refreshed signed data and a [source catalogue](docs/data-sources/election-2026.md). See the [election-night runbook](docs/operations/election-night-2026.md) for cadence, validation, fallback and the remaining production verification gate.

Universal search is available from every header (⌘/Ctrl K) at `/search/` and `/en/search/`. It indexes site content, dated political context, all imported 2022 personal-vote candidates, parties, counties, municipalities, constituencies, districts and collection votes, plus SCB’s 2,017 named urban localities (2023 geography, names revised November 2025). Search keeps query/filter/page state across language changes and history. Candidate links select the exact party/candidate/constituency; locality links explicitly open municipal results. See [search coverage and sources](docs/data-sources/universal-search.md).

The site header hides when scrolling down and returns when scrolling up. An active menu item and a localized “You are here” trail identify the current page; the map adds its verified county, municipality and district with links back through the hierarchy. Keyboard access, reduced motion and anchor offsets remain available.

The election archive separates the largest party, each election's bloc seat totals and the government that followed. It shows majority status, cabinet parties, support-party context and source-linked party mandates for 2002–2022, including the distinct January 2019 government formation after the 2018 election. See [historical election outcomes](docs/methodology/election-outcomes-v1.md).

The `/maps/` explorer now drills from 21 counties to 290 municipalities and 6,264 physical 2022 electoral districts. It includes municipal/county Riksdag history for 2010–2022, 4,162 verified district comparisons with 2018, collection votes, and 2022 personal-vote tables. All constituencies in the selected county remain available from a municipality or district, with visible buttons for counties containing several constituencies. The municipality's own constituency is the default; choosing another changes only the personal-vote table. Swedish/English switching preserves the selected area, party, year and constituency. See [local election sources and methodology](docs/data-sources/local-election-geography.md) for boundary changes, overseas votes and the precise geographic limit of personal votes.

This README is the canonical product and engineering description for **Into The Politicalverse**. New contributors and coding agents should read it before changing architecture or product behavior.

The initial market is **Sweden**, with the 2026 general election as the first live election cycle. The architecture must not assume that Sweden is the final market: election types, parties, geography, sources and electoral systems should remain extensible.

The conceptual inspiration is the analytical experience of quantitative financial platforms: large historical datasets become understandable through charts, indicators, comparisons and models. Politicalverse applies that approach to election data. It is not a political news site, social network, campaign platform or partisan recommendation engine.

Politicalverse should answer questions such as:

- How has a party performed over multiple election cycles?
- Where is a party structurally strongest or weakest?
- Where did the largest swing occur?
- Is support geographically broadening or concentrating?
- How does a municipality or district compare with the national baseline?
- How has turnout changed geographically and over time?
- What parliamentary outcomes are possible under a given vote-share scenario?
- How sensitive is a coalition outcome to a party crossing the electoral threshold?
- What does a model estimate, how uncertain is it, and which observations produced the estimate?

The product promise is simple:

> **Every number should be explorable. Every derived value should be reproducible. Every model should be distinguishable from fact.**

---

## 1. Product principles

### 1.1 No mystery numbers

Every displayed item belongs to an explicit source/analysis class:

**OFFICIAL** — reproduced from an authoritative source such as Valmyndigheten or SCB.

**POLL** — an opinion-survey observation. It is neither an official result nor a Politicalverse probability.

**DERIVED** — calculated by Politicalverse from identified source observations using a documented deterministic methodology, for example swing or relative strength.

**MODEL** — an estimate, probability, forecast or simulation. Models must expose methodology, inputs, timestamp/version and uncertainty where applicable.

**DECLARED** — a dated, sourced public position from a party or leader.

**CONTEXT** — a sourced constitutional rule or explanatory fact that is not model output.

The UI must never visually blur these categories. `DECLARED` and `CONTEXT` explain political consequences but are not quantitative forecasts.

### 1.2 Source provenance is a product feature

Important values should retain enough provenance to answer:

- Who published the source data?
- Which dataset/version was used?
- When did the source publish or update it?
- When did Politicalverse ingest it?
- Was the value supplied by the source or calculated by Politicalverse?
- If calculated, which method/version produced it?

Users should be able to navigate from an important Politicalverse value to its source/methodology.

### 1.3 Neutral quantitative infrastructure

Politicalverse does not endorse parties or candidates. Identical analytical rules should apply across parties. Party ordering must not be manipulated to imply endorsement. Editorial language around quantitative outputs should remain factual and restrained.

### 1.4 Mobile is not a reduced product

Phone, tablet, laptop and large desktop are first-class targets. Responsive behavior is a functional requirement, not final-stage polish.

Charts must remain readable and interactive on small screens. Large tables should transform, scroll or progressively disclose rather than overflow unusably. Maps and simulators require touch-friendly controls. Primary interactions should not depend on hover.

### 1.5 Build the public product before the paywall

The first releases should maximize useful public exploration. Authentication and billing are separate platform capabilities and must not contaminate election ingestion, indicators or chart logic.

No account should initially be required to browse core public election information.

Future account functionality can include saved charts, watchlists, workspaces, custom indicators, exports and preferences. Future Pro functionality can include advanced models, Workbench capabilities, professional exports, deeper historical analytics and higher-value intelligence features.

### 1.6 Official data before decoration

A real chart backed by validated official data is more valuable than a polished dashboard containing invented demonstration values. Production UI must not present mock values as real observations.

---

## 2. Initial audience

The public layer should be understandable to politically interested citizens while the analytical depth should support professional use.

Potential professional users include:

- journalists and newsrooms;
- political analysts;
- public-affairs teams;
- researchers and academics;
- political parties and campaign analysts;
- polling and communications professionals;
- organisations exposed to election outcomes;
- data journalists and developers.

The long-term business model is expected to be **open discovery + paid professional analytics**, rather than putting basic election facts behind a login wall.

---

## 3. Initial product information architecture

### Overview

The home dashboard should immediately demonstrate the product using the current model and official historical election information. It should surface the current election cycle, resolved prediction questions, uncertainty, evidence counts and paths into deeper exploration.

### Forecasts

Forecasts are a first-class, question-led analytical destination. Each prediction must state its resolution rule, probability, uncertainty, data cutoff, model version and explanation of what the result does—and does not—mean. The experience may borrow the clarity of a prediction-market question, probability and history, but Politicalverse does not offer wagering and its model outputs are not market prices.

The initial 2026 terminal covers vote and mandate distributions, threshold risk, largest-party questions and named coalition mandate arithmetic. Sourced government-formation context remains separate from model probability. Politicalverse does not publish person or minister odds without a dedicated sourced and backtested model.

### Charts

Charts are a primary product destination, not illustrations attached to articles. The chart engine should eventually support large numbers of parameterized views without requiring a bespoke component for every combination.

Useful dimensions include:

- election year;
- election type;
- party;
- geography level;
- geography;
- metric;
- comparison baseline;
- time range.

### Parties

Each party receives an analytical profile containing official identity, historical performance, geographic distribution, swing, strongest/weakest areas, relative strength and relevant indicators.

The initial parliamentary registry includes:

- Socialdemokraterna (S)
- Sverigedemokraterna (SD)
- Moderaterna (M)
- Vänsterpartiet (V)
- Centerpartiet (C)
- Kristdemokraterna (KD)
- Miljöpartiet (MP)
- Liberalerna (L)

The registry must support additional and local parties without architectural changes.

### Maps

Election geography should become a major Politicalverse surface. Users should be able to select party, metric, election and geography and explore spatial patterns.

Examples:

- vote share;
- election-to-election swing;
- turnout;
- relative strength;
- party rank;
- geographic change.

The 2026 system should support official election geography/GIS when available from Valmyndigheten.

### Elections

Election pages organize results by election and level: national/Riksdag, region and municipality, with deeper geography where source data permits it.

### Indicators

Politicalverse indicators turn raw observations into reproducible analytical signals. Candidate indicators include:

**National Swing** — change in vote share between comparable elections.

**Geographic Breadth** — how broadly a party is improving/declining across comparable geographic units.

**Relative Strength** — local party performance relative to an appropriate national or higher-level baseline.

**Turnout Trend** — participation change across elections and geography.

**Geographic Concentration** — whether support is concentrated in a smaller set of areas or broadly distributed.

**Electoral Volatility** — magnitude of electoral movement across parties/geographies using a documented definition.

Indicators must not be shipped merely because their names sound useful. Definitions, edge cases and backtests come first.

### Simulator

The election simulator should allow users to adjust party vote shares and immediately calculate electoral consequences according to the applicable Swedish electoral rules.

Longer-term functionality can include:

- parliamentary seat estimates;
- threshold sensitivity;
- coalition combinations;
- majority/minority outcomes;
- scenario saving;
- uncertainty ranges;
- Monte Carlo simulations where statistically justified.

A deterministic scenario calculator and a probabilistic forecast are different products and must be labelled differently.

### Workbench — later phase

A professional Workbench can allow users to construct comparisons and indicators by choosing dimensions and metrics without programming.

Example:

`Party: SD → Metric: Swing → Geography: Municipality → Election: 2022 → Baseline: 2018`

or an aggregate-data research view such as:

`X: median income → Y: party vote share → Observation: municipality`

Correlation must never be presented as proof of individual voter behavior or causation.

---

## 4. Party identity and logos

Party identity is centralized in `lib/parties.ts` rather than duplicated throughout components.

Each party entity should support at minimum:

- stable internal ID;
- official/recognized name;
- short name;
- display color;
- local logo asset path;
- logo provenance/source;
- source metadata where appropriate.

**Real party logos are a product requirement.** Assets should be obtained from official party media/brand resources where possible and stored locally so the application does not depend on third-party hotlinks. Asset provenance and relevant usage terms should be recorded.

Components should use a shared PartyMark/PartyIdentity abstraction. Missing artwork must degrade gracefully without breaking layout.

---

## 5. Authoritative data sources

### Valmyndigheten — primary election authority

Valmyndigheten is the initial source of truth for official Swedish election information.

Target datasets include, where available:

- elections;
- parties;
- candidates;
- constituencies;
- municipalities;
- electoral districts;
- votes/results;
- vote shares derived from official counts;
- eligible voters;
- turnout;
- mandates/seats;
- personal votes;
- 2026 election data;
- geographic/GIS definitions.

Initial source registry:

- 2026 raw election data: `https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026`
- historical raw election data 2002–2022: `https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022`

### SCB PxWeb — contextual aggregate statistics

SCB is the initial source for aggregate demographic and socioeconomic context that can later be compared with geographic election outcomes.

Potential dimensions include:

- population;
- age structure;
- education;
- employment/unemployment;
- income;
- population density and other relevant aggregate statistics.

SCB integration must preserve table/query metadata so an analysis can be reproduced.

### Opinion polling — separate source class

Polling is not official election data and must never be merged semantically with official results.

The accepted first poll bank is the CC0-licensed `SwedishPolls/Data/Polls.csv` snapshot. Politicalverse preserves pollster/house, publication date, fieldwork start/end, approximate-date flag, sample size, party estimates, source commit, retrieval time and checksums. It is classified `POLL`, cross-checked against recent Novus, Verian/SVT and SCB publications, and documented in [`docs/data-sources/opinion-polls.md`](docs/data-sources/opinion-polls.md).

Polling adapters support fields such as:

- pollster;
- publication date;
- fieldwork start/end;
- sample size;
- collection/method notes;
- party estimate;
- source URL;
- retrieval timestamp.

The six-hour refresh is fail-closed: exact schema, strict real calendar dates, present-day/election-day bounds, monotonicity, row count, complete recent observations, duplicates, impossible values, primary anchors and hashes must pass before an atomic snapshot replacement. A failure leaves the last-known-good public forecast in place, and the updater becomes a no-op after election day. SwedishPolls remains an aggregation with disclosed limitations, not authoritative election infrastructure.

---

## 6. Living-data architecture

Politicalverse must be a data system, not a collection of manually maintained JSON files.

Canonical pipeline:

`source adapter → raw snapshot → validation → normalization → canonical storage → derived metrics → API/application layer → UI`

### Source adapters

Each external authority receives isolated adapters. A source-format change should not require rewriting analytics or UI.

Conceptual structure:

```text
sources/
  valmyndigheten/
    elections
    parties
    candidates
    geography
    results
  scb/
    population
    education
    income
    employment
  polls/
    <source-adapters>
```

### Immutable raw snapshots

Do not destroy previously observed source states by overwriting them. Raw ingestion should retain snapshots or equivalent version history where data can change.

This is especially important during the 2026 election, where preliminary results can evolve throughout election night and later be replaced by final official results.

### Validation gate

External data never becomes trusted application data merely because an HTTP request succeeded.

Validation should detect issues such as:

- schema changes;
- unknown geography codes;
- unknown party identifiers;
- duplicate records;
- negative vote counts;
- impossible turnout values;
- inconsistent totals;
- missing required fields;
- unexpected source/version changes.

If a source fails validation, the last verified production dataset should remain available and source health should be marked degraded. Bad upstream data should fail closed rather than silently corrupt analytics.

### Normalization

Source-specific representations should be mapped into stable Politicalverse entities and identifiers. UI components and indicator code should consume canonical models, not raw CSV column names.

### Derived-data layer

Derived metrics should be recalculated when relevant canonical source data changes. Calculation code should be deterministic, versioned and testable.

Conceptually:

`new verified data → normalize → calculate affected metrics → update application layer/cache`

### Source freshness

Ingestion cadence depends on source behavior rather than one global cron interval.

Examples:

- slowly changing historical datasets: check metadata/change state and ingest only when needed;
- active 2026 datasets: synchronize according to source update cadence and responsible request limits;
- election-night results: dedicated Election Mode with tighter refresh behavior while respecting the authority's technical constraints;
- SCB context: refresh when source tables change rather than wastefully downloading unchanged datasets.

Freshness metadata should be visible to users where relevant.

---

## 7. Canonical data model

The exact persistence technology may evolve, but the conceptual model should include stable entities for:

### Election

- ID
- country
- year/date
- election type
- status (upcoming/preliminary/final)

### Geography

- stable Politicalverse ID
- official source code
- name
- level/type
- parent geography
- valid-from / valid-to when boundaries change
- geometry reference where available

Boundary changes are important: historical geographic comparisons must not assume that a district with a similar name is automatically identical across elections.

### Party

- stable ID
- source identifiers
- name/short name
- identity metadata
- logo metadata

### Candidate

- stable/source IDs where available
- party/election relationships
- constituency/geography relationships
- official candidate metadata only as required by product functionality

### Election result observation

- election
- geography
- party/candidate where relevant
- votes
- eligible voters where applicable
- source metadata
- observation status
- source version/timestamp

Vote share should be reproducibly derivable from authoritative counts wherever possible rather than treated as an unexplained independent number.

### Poll observation

Kept logically separate from election results.

### Derived metric observation

- metric ID/version
- dimensions
- value
- source observation references
- calculation timestamp

### Model output

- model ID/version
- run timestamp
- inputs/data cutoff
- estimate/probability/range
- calibration/uncertainty metadata where applicable

---

## 8. Initial indicator methodology direction

### Swing

For comparable party/geography/election observations:

`Swing (percentage points) = current vote share − previous comparable vote share`

UI must distinguish percentage points from percent change.

### Relative strength

A useful initial definition is local vote share relative to the selected higher-level baseline. The exact formula and behavior near zero must be specified before production release.

### Geographic breadth

At a selected geography level, calculate the share of comparable geographic units in which a party's vote share improved versus the baseline election. Weighting choices must be explicit: an unweighted municipality breadth indicator answers a different question than voter-weighted breadth.

### Geographic concentration

Evaluate whether party support is broadly distributed or concentrated. Candidate methodologies should be compared/backtested before selecting the production definition.

All methodology pages should include plain-language interpretation, formula/algorithm, inputs, limitations and version history.

---

## 9. Forecasting policy

Politicalverse should not publish pseudo-precision.

The 2026 beta forecast is published only because:

1. polling sources and historical data are normalized;
2. the model is backtested against previous election cycles where feasible;
3. house concentration and poll recency are explicitly controlled;
4. uncertainty is represented;
5. model version and data cutoff are visible;
6. deterministic election-law calculations are separated from statistical estimates.

Version `1.0.0-beta.1` freezes a 180-day window and 28-day half-life as fixed design choices assessed on 2010–2018, with 2022 retained as a locked holdout; the repository does not claim an exhaustive parameter search. The eight-party model does not zero-fill incomparable 2002/2006 polls. It runs 10,000 seeded antithetic heavy-tail simulations through the exact 29-constituency mandate engine, uses seeded reproducible lottningar for exact quotient ties, and exposes uncertainty, backtest errors and tie frequency. `OTHER` is a seat-ineligible aggregate in v1, not a prediction that a new named party enters. Full behavior and limitations are in [`docs/methodology/forecast-v1.md`](docs/methodology/forecast-v1.md).

A displayed forecast such as `23.4%` must never imply certainty that the underlying model cannot support. Mandate-majority probability is not government-formation probability, and the beta publishes no named minister/person odds.

---

## 10. Election simulator architecture

The simulator should be implemented as an independent, testable election-law calculation layer rather than embedding seat logic inside UI components.

Inputs → validated vote-share scenario → electoral-rule engine → seat/threshold output → coalition analysis → UI.

The engine should be unit-tested against known official historical outcomes before being trusted for hypothetical scenarios.

---

## 11. UX and visual direction

The intended character is analytical, premium and data-dense without becoming visually noisy.

Current foundation direction:

- independent public-service visual language inspired by Sveriges riksdag, without reproducing an official identity;
- deep blue, ice-gray and white analytical surfaces with a restrained lemon election accent;
- strong accessible typography and visible focus treatment;
- party colors reserved primarily for party identity/data;
- clear source/freshness labels;
- charts as primary content;
- minimal marketing filler;
- responsive layouts designed at component level.

The maintained palette, usage rules and source references are documented in [`docs/design/visual-system.md`](docs/design/visual-system.md).

### Responsive requirements

At minimum test representative widths for:

- small phone;
- large phone;
- tablet portrait/landscape;
- laptop;
- standard desktop;
- wide desktop.

Charts need responsive margins, readable labels, touch targets and mobile legends/tooltips. Data tables should have deliberate small-screen behavior. Maps should not require precision mouse interaction.

Accessibility requirements include semantic navigation, keyboard support, visible focus, meaningful alt text for identity assets, sufficient contrast and avoiding color as the sole carrier of party/metric meaning.

---

## 12. Public/free/account/Pro structure

Do not build billing before product value exists, but preserve these boundaries.

### Open — no account required

Public election results, provenance, historical charts, party profiles, geographic summaries and core methodology remain browsable without sign-in.

### Free account — later

An account becomes useful when a visitor wants to save a chart, watchlist, comparison, workspace or simulation. Account state must remain separate from official data ingestion and calculations.

### Pro — later

Professional access may eventually cover advanced indicators, Workbench capabilities, exports and validated models. Pricing and billing should not be implemented until those features create real value.

---

## 13. Current implementation

The repository contains the public analytical release and the 2026 prediction terminal:

- Next.js 16 and TypeScript application routes for Overview, Forecasts, Charts, Parties, Maps, Elections, Indicators and Simulator;
- official final national Riksdag history for every general election from 2002 through 2022;
- a checksum-verified Valmyndigheten 2022 XLSX importer;
- 6,578 electoral districts normalized into 29 constituencies and 290 municipalities;
- responsive historical chart, result table, Party Explorer and municipal summaries;
- checksum-verified official 2018 observations for all 290 municipalities, with exact code-and-name joins to 2022;
- a touch- and keyboard-accessible Election Map for 2022 vote share, 2018–2022 swing and turnout across all 290 municipality geometries;
- four deterministic, versioned `DERIVED` indicators with published methodology;
- an independent deterministic Riksdag seat engine implementing the current thresholds and mandate-allocation rules;
- a responsive `MODEL` scenario simulator using the official 2026 fixed-seat structure and a disclosed 2022 geographic-pattern assumption;
- exact engine backtests against every parliamentary party's official fixed, adjustment and total mandates in 2018 and 2022;
- a checksum-pinned CC0 SwedishPolls bank, seven primary cross-checks and a fail-closed six-hour refresh;
- a versioned `MODEL` 2026 forecast with a frozen polling average, 10,000 seeded simulations, vote/mandate intervals, threshold and coalition-majority questions, historical calibration and a locked 2022 holdout;
- a source-dated `DECLARED`/`CONTEXT` government-formation registry that explains negative parliamentarism without inventing person or minister probabilities;
- local identity assets for all eight parliamentary parties with recorded provenance;
- static read-only national, geography, municipality-comparison, forecast and government-context JSON endpoints;
- a documented, independent Riksdag-inspired responsive visual system;
- a fail-closed runtime-isolation check that protects known radio/service ports and rejects tunnel conflicts;
- a static GitHub Pages release workflow isolated to this repository;
- CI, data and regression tests, linting, strict type checking and production/static export gates.

### Maintenance checkpoint — 2026-09-06

Polling refresh tests now validate moving historical windows against the actual input rows instead of fixed August counts. The accepted bank includes measurements through 4 September. Primary-source date corrections are versioned separately from the frozen forecast methodology, and both public forecast pages show the underlay date and browser-calculated age. Government context was manually reviewed on 6 September, including KD's September statement. All 28 pinned official source files were fetched again and matched their checksums; four additional historical pages were reachable. See `docs/data-sources/source-review-2026-09-06.md` for scope and evidence.

### Public release

The public static release is published from this repository by GitHub Actions to [willrydh.github.io/Into-The-Politicalverse](https://willrydh.github.io/Into-The-Politicalverse/). It requires no account or password. Normal source pushes to `main` use the Pages workflow, which validates data, lint, types and tests before building and deploying. An accepted scheduled polling refresh is committed with the repository `GITHUB_TOKEN`, whose push does not start another workflow; the refresh workflow therefore checks out that exact accepted commit, repeats the Pages gates, builds and deploys it itself. An unchanged or rejected refresh never deploys, and a final `main` check prevents an older snapshot from replacing a newer human-pushed release. Neither path uses another project, domain, personal token or hosting configuration.

### Run locally

Node.js 20.9 or newer is required.

```bash
npm install
npm run dev
```

Development may run only from the verified `main`, legacy `agent/foundation` or scoped `codex/*` branch. `npm run dev` first checks the repository identity, branch, fixed loopback address, port availability and local tunnel/service definitions, then starts at `http://127.0.0.1:4317`. The check fails closed rather than selecting another port.

Run the complete local gate:

```bash
npm run data:verify
npm run check
```

### Data pipeline

```text
Valmyndigheten source
  -> checksum and worksheet-schema validation
  -> canonical party and geography normalization
  -> national / constituency / municipality JSON
  -> application data layer and public APIs
  -> charts, profiles and derived indicators

Valmyndigheten 2022 county GIS archives
  -> 21 archive checksum and district-code validation
  -> topology clean / municipality dissolve / WGS 84 normalization
  -> exact 290-code join to official municipality results
  -> touch and keyboard accessible Election Map

Valmyndigheten 2018 municipality workbook + normalized 2022 results
  -> source checksum and official-total validation
  -> exact 290-code-and-name comparability join
  -> party swing / turnout change / geographic breadth
  -> static comparison API and Election Map swing layer

Valmyndigheten 2018 / 2022 / 2026 seat sources
  -> checksum and official-total validation
  -> canonical 29-constituency vote and fixed-seat inputs
  -> exact historical engine backtests
  -> deterministic 2026 Riksdag scenario model

SwedishPolls CSV + immutable upstream file commit
  -> schema / monotonicity / duplicate / range / primary-anchor validation
  -> 180-day, 28-day-half-life polling average
  -> historical error calibration and locked 2022 holdout
  -> 10,000 seeded heavy-tail simulations
  -> exact 29-constituency mandate engine
  -> vote, mandate, threshold and coalition-majority MODEL outputs
```

The downloaded source workbook is reproducible and intentionally ignored. Import it directly from the recorded URL:

```bash
npm run data:import
```

Or use an already downloaded workbook:

```bash
npm run data:import -- --file /path/to/valmyndigheten-riksdag-2022.xlsx
```

Regenerate municipality boundaries from the recorded official GIS archives:

```bash
npm run data:import:geography
```

Regenerate the comparable 2018 municipality baseline:

```bash
npm run data:import:municipality-history
```

Regenerate the historical backtest fixtures and 2026 fixed-seat inputs:

```bash
npm run data:import:seats
```

Regenerate the forecast from the accepted raw poll snapshot, or run the guarded upstream refresh:

```bash
npm run data:forecast:generate
npm run data:polls:update
```

Election source URL, retrieval date, expected totals and SHA-256 are pinned in [`data/raw/valmyndigheten/source-manifest.json`](data/raw/valmyndigheten/source-manifest.json). National history normalization is documented in [`docs/data-sources/valmyndigheten-national-history.md`](docs/data-sources/valmyndigheten-national-history.md). The comparable 2018 municipality source is documented in [`docs/data-sources/valmyndigheten-municipality-history.md`](docs/data-sources/valmyndigheten-municipality-history.md), and swing behavior in [`docs/methodology/municipality-swing-v1.md`](docs/methodology/municipality-swing-v1.md).

The 21 official GIS archives, coordinate transformation and municipality joins are documented in [`docs/data-sources/valmyndigheten-geography.md`](docs/data-sources/valmyndigheten-geography.md). Party artwork provenance is recorded in [`docs/data-sources/party-assets.md`](docs/data-sources/party-assets.md), and indicator definitions in [`docs/methodology/indicators-v1.md`](docs/methodology/indicators-v1.md).

Seat-source snapshots and checksums are documented in [`docs/data-sources/valmyndigheten-seats.md`](docs/data-sources/valmyndigheten-seats.md). The electoral rules, geographic projection, exact 2018/2022 backtests and limitations are documented in [`docs/methodology/simulator-v1.md`](docs/methodology/simulator-v1.md).

Poll source provenance, license, hashes, primary anchors and quarantine behavior are documented in [`docs/data-sources/opinion-polls.md`](docs/data-sources/opinion-polls.md). Forecast averaging, calibration, uncertainty, mandate projection and limitations are documented in [`docs/methodology/forecast-v1.md`](docs/methodology/forecast-v1.md). Government-formation context rules are documented in [`docs/data-sources/government-formation-2026.md`](docs/data-sources/government-formation-2026.md).

### Public APIs

- `GET /api/elections/2022/national.json`
- `GET /api/elections/2022/geography/constituencies.json`
- `GET /api/elections/2022/geography/municipalities.json`
- `GET /api/elections/comparisons/2018-2022/municipalities.json`
- `GET /api/forecasts/2026.json`
- `GET /api/context/government-formation-2026.json`
- `GET /api/elections/local/index.json`
- `GET /api/elections/local/municipalities/{municipalityCode}.json`
- `GET /api/elections/local/personal/{constituencyCode}.json`

Regenerate the local explorer with `npm run data:import:local` and its personal-vote source with `npm run data:import:personal`. Both preserve pinned sources and output hashes. `data:verify` checks every county/municipality total and every district map join, including collection votes and personal-vote denominators.

The `.json` paths are intentionally static-export compatible and include source/classification metadata.

### Post-v1 roadmap

1. Add official 2026 adapters as Valmyndigheten publishes live-cycle datasets, while preserving preliminary/final source states.
2. Accumulate forecast snapshots and score every resolved prediction against the final official result; never retune silently.
3. Parameterize additional charts and maps by geography, metric and election without duplicating components.
4. Add SCB aggregate context through a separate, provenance-preserving PxWeb adapter.
5. Expand models only when every new assumption, source and resolution rule remains explicit and backtested.
6. Consider saved workspaces/auth only after they provide a concrete analytical benefit; keep billing outside the data engine.
