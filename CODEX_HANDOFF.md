# Codex takeover brief — Into The Politicalverse

## Mission

Take over active development of **Into The Politicalverse**, a quantitative election intelligence platform. Continue from the existing `agent/foundation` branch and treat `README.md` as the canonical product/architecture specification.

The initial launch market is Sweden, with the 2026 general election as the first live election cycle. The product should feel like a quantitative analytics terminal for elections: charts, maps, indicators, party profiles, simulations and later forecasting/workbench capabilities.

## Implementation checkpoint — 2026-08-21

The first usable public release slice is now implemented on `agent/foundation` and continues in draft PR #1.

Delivered:

- buildable Next.js 16 + TypeScript application with CI;
- verified 2022 Valmyndigheten XLSX ingestion and normalized national, constituency and municipality records;
- official national history for 2006–2022;
- real responsive chart, result table and read-only JSON APIs;
- local, source-recorded identity assets for all eight parliamentary parties;
- Party Explorer using real national and municipality results;
- an interactive Election Map for party vote share and turnout across all 290 municipalities, using checksum-pinned official 2022 GIS archives;
- four deterministic `DERIVED` indicators, versioned methodology and regression tests;
- an independent Riksdag-inspired public-service visual system, documented with source references and without official logos;
- a fail-closed local runtime preflight fixed to `127.0.0.1:4317`, with known radio/service ports and tunnel routes protected;
- desktop and 390 px mobile browser acceptance checks.

Local verification is green: `npm run data:verify` and `npm run check` (lint, strict typecheck, 11 regression tests and production build). The dependency audit endpoint was unreachable from the isolated development environment; do not treat that as a successful audit. No hosting target is configured, so this checkpoint is pushed and PR-verified but not deployed or live-verified.

The next major product priority is P7: a deterministic Swedish election simulator with explicit electoral rules and historical backtests. The map's cross-election swing layer remains pending until comparable 2018 municipality observations are sourced and normalized; the current historical national series starts in 2006 and the 2002 observation remains explicit follow-up work.

## Non-negotiable product principles

1. No mystery numbers. Every displayed value must be classified as `OFFICIAL`, `DERIVED`, or `MODEL`.
2. Valmyndigheten is the primary source of truth for official Swedish election data.
3. SCB PxWeb is the primary source for aggregate demographic/economic context.
4. Raw source states must be preserved/versioned rather than destructively overwritten when data can change.
5. Derived metrics must be deterministic, testable, documented and reproducible.
6. Models/forecasts must be visually and semantically separated from official results.
7. No account is required to browse the initial public product.
8. Do not build billing/paywall before the core public data product is useful.
9. Party logos are required. Use official party media/brand assets where possible, store them locally, and record provenance/usage notes.
10. Mobile, tablet, laptop and large desktop are first-class targets. Do not ship desktop-only dashboards.
11. Do not present mock/demo values as if they were real election data.
12. Remain politically neutral in data treatment, ordering and analytical language.

## Existing code

Current branch: `agent/foundation`

Existing foundation includes:

- Next.js 16 + TypeScript product routes and responsive data-first dashboard
- deterministic Valmyndigheten import, validation and normalization pipeline
- checked-in normalized 2022 national, constituency and municipality results
- official national history for five Riksdag elections from 2006 through 2022
- centralized `lib/parties.ts` identity registry and eight local party assets
- historical chart, Party Explorer, election archive and Politicalverse indicators
- official 2022 municipality geometry plus a touch- and keyboard-accessible party-share/turnout map
- explicit `OFFICIAL` and `DERIVED` classifications with source/methodology documentation
- eleven route, calendar, data, geometry, calculation and asset-provenance tests
- GitHub Actions CI and draft PR #1 targeting `main`

Do not rewrite the product from scratch unless a technical defect requires it. Improve incrementally.

## Immediate priority order

### P0 — make the repository actually build and test

1. Inspect the current branch.
2. Run install/build/typecheck/lint.
3. Fix all runtime, TypeScript, dependency and CSS issues.
4. Add sensible scripts if missing (`typecheck`, `lint`, `test` as appropriate).
5. Add GitHub Actions CI for install + typecheck + build.

No feature work should be considered complete if the branch does not build cleanly.

### P1 — connect real Valmyndigheten historical data

Build a source adapter rather than hardcoding data into UI components.

Target initial source:

- Historical raw election data 2002–2022:
  `https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022`

Also prepare for:

- 2026 data:
  `https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-val-2026`

Implementation requirements:

- source-specific adapter layer
- immutable/raw snapshot concept
- schema validation
- normalized canonical records
- source metadata/provenance
- no UI dependency on raw source column names
- clear treatment of election status (historical/final vs preliminary/live)

The first vertical slice should be:

`Valmyndigheten -> ingest -> validate -> normalize -> application data layer -> real historical chart`

### P2 — replace the placeholder chart with a real chart

The first production chart should use official historical Riksdag results.

Recommended first chart:

**Historical party performance — Riksdag, 2002–2022**

Requirements:

- selectable party or multiple parties if legible
- real official observations only
- responsive on mobile
- source/provenance label
- tooltip with election year, vote share and source class
- accessible legend/labels
- party colors from centralized registry

### P3 — official party logos

Acquire official/recognized assets for:

- Socialdemokraterna (S)
- Sverigedemokraterna (SD)
- Moderaterna (M)
- Vänsterpartiet (V)
- Centerpartiet (C)
- Kristdemokraterna (KD)
- Miljöpartiet (MP)
- Liberalerna (L)

Store assets locally under a consistent path such as `public/parties/`.

Add an asset provenance note/file containing source URL and acquisition date. Do not hotlink external logos in production.

### P4 — Party Explorer

Implement party analytical pages/routes.

Minimum useful view:

- party identity + logo
- historical national Riksdag vote share
- election-to-election swing
- strongest/weakest available geographies
- source labels
- links to deeper charts/maps when available

The data model must support additional/local parties later.

### P5 — geographic layer and map foundation

Prepare canonical geography entities for Sweden and official codes. Boundary/version changes must be represented rather than ignored.

Then add map support from official Valmyndigheten GIS/geographic data where available.

Initial map metrics:

- party vote share
- swing vs previous comparable election
- turnout

Map interaction must work on touch devices, not only mouse hover.

### P6 — first derived indicators

Implement only after real normalized data is available.

Start with:

1. Swing (percentage points)
2. Geographic Breadth
3. Relative Strength
4. Turnout Trend

Each metric requires:

- pure/testable calculation
- methodology documentation
- explicit handling of missing/incomparable geography
- version identifier
- unit tests
- source observation references where feasible

Do not ship pseudo-indicators with arbitrary formulas.

### P7 — election simulator

Build the simulator logic as an independent election-rule engine, not UI math.

Initial goal:

- party vote-share input controls
- Swedish threshold handling
- seat/mandate calculation according to applicable rules
- scenario output
- coalition arithmetic

Before trusting the engine, backtest it against known official historical election outcomes.

A deterministic simulator is not a forecast. Label accordingly.

## Architecture direction

Keep external source adapters isolated from canonical domain models.

Suggested logical structure (adjust if needed, preserve separation):

```text
app/
  overview/
  charts/
  parties/
  maps/
  elections/
  indicators/
  simulator/

components/
  charts/
  dashboard/
  maps/
  parties/

lib/
  domain/
  data/
    sources/
      valmyndigheten/
      scb/
      polls/
    validation/
    normalization/
  indicators/
  simulator/
  geography/

public/
  parties/

docs/
  methodology/
  data-sources/
```

This is guidance, not a mandate to create empty directories.

## Data provenance contract

At minimum, important observations should retain:

- authority/source
- dataset identifier/name
- source URL
- source publication/update timestamp if available
- ingestion timestamp
- source status/version if available
- classification: OFFICIAL / DERIVED / MODEL

Derived outputs should also retain:

- calculation/metric ID
- methodology version
- inputs or references to source observations where feasible
- calculation timestamp

Model outputs should also retain:

- model ID/version
- data cutoff
- run timestamp
- uncertainty/calibration fields where applicable

## Polling policy

Do not make polling ingestion block the first release.

Polling is a separate source class and must not be treated as official result data.

When adding polling later:

- use source-specific adapters
- preserve pollster, fieldwork dates, sample size, publication date, method notes and source URL
- verify source/usage conditions before automated ingestion
- do not silently scrape a third-party poll aggregator and make it core infrastructure

## UX direction

The design should feel premium, analytical and data-first.

Current visual direction is an independent public-service system inspired by Sveriges riksdag: white and ice-gray analytical surfaces, deep blue institutional structure and a restrained lemon accent. It must not reproduce an official logo or imply that Politicalverse is an official government service. Preserve the chart-led hierarchy, strong typography and minimal marketing filler. The maintained tokens and references are in `docs/design/visual-system.md`.

Critical responsive behavior:

- no horizontal page overflow
- charts resize intelligently
- legends/tooltips remain usable on phone
- tables deliberately scroll/transform
- tap targets are large enough
- maps support tap/selection
- navigation has a mobile treatment
- no essential information depends on hover

Accessibility:

- semantic navigation
- keyboard interaction where relevant
- visible focus states
- meaningful alt text for logos
- sufficient contrast
- do not use color as the only identifier for parties or states

## Auth/paywall policy

Do not prioritize auth or Stripe now.

Keep architecture decoupled so these can be added later.

Likely future product levels:

- `Open`: public core election data/charts, no account required
- `Free account`: saved charts/watchlists/preferences
- `Pro`: advanced indicators, workbench, exports, deeper models/intelligence

Do not let future billing concerns distort the initial domain/data model.

## Delivery discipline

Work autonomously. Do not stop for routine technology/library/structure decisions when a reasonable engineering choice can be made.

Before major rewrites, inspect existing code and preserve what is already sound.

For each meaningful milestone:

1. implement;
2. run validation/build/tests;
3. update docs/methodology where behavior changes;
4. commit with a clear message;
5. keep PR #1 coherent or create focused follow-up PRs if the scope becomes too broad.

Do not claim a feature works unless it has been validated in the repo/runtime.

## Definition of first usable release

A first genuinely usable release exists when a visitor can open the site without an account and:

1. understand that Politicalverse is quantitative election analysis;
2. see real official Swedish historical election data;
3. explore at least one responsive chart;
4. select/inspect the major parliamentary parties with real logos;
5. see exact source/provenance information;
6. navigate cleanly on phone and desktop;
7. distinguish official data from Politicalverse calculations;
8. run from a clean, tested build.

After that, prioritize Party Explorer, maps, indicators and simulator before auth/paywall.

## Current handoff state

Repository: `willrydh/Into-The-Politicalverse`

Continue from: `agent/foundation`

Draft PR: `#1 Build Politicalverse foundation`

Canonical specification: `README.md`

Verified next action: specify the applicable Swedish Riksdag threshold and seat-allocation rules, encode them as an independent deterministic engine, and backtest against official historical outcomes before exposing simulator controls. Keep the unimplemented municipality swing map explicit until comparable 2018 observations are normalized. Do not begin auth, Stripe or a forecast first.

This file is the execution brief. If it conflicts with `README.md` on product intent, `README.md` wins. If implementation reality changes, update both deliberately rather than allowing silent architectural drift.
