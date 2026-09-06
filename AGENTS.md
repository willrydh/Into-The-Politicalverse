<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Into The Politicalverse — Agent Instructions

Read `README.md` and `CODEX_HANDOFF.md` before making material changes.

## Mission
Build a production-quality quantitative election intelligence platform, initially for Sweden and the 2026 general election cycle.

## Immediate execution order
1. Make the current branch install, typecheck, build and lint cleanly.
2. Keep polling refresh, forecast generation, source checksums and the last-known-good quarantine green.
3. Improve forecast explanation and calibration only with versioned methodology and backtests.
4. Add official 2026 Valmyndigheten adapters when the relevant live-cycle sources appear; preserve preliminary and final states separately.
5. Expand parameterized charts, geography and SCB context without coupling them to polling or UI source formats.
6. Only after the public analytical product is useful, consider auth/paywall.

## Hard rules
- Never present invented/demo values as real election data.
- Every quantitative output must be clearly classifiable as OFFICIAL, POLL, DERIVED or MODEL. Sourced political material must be DECLARED or CONTEXT.
- Valmyndigheten is the primary authority for official Swedish election data.
- SCB PxWeb is the initial authority for aggregate socioeconomic/demographic context.
- Preserve source provenance and freshness metadata.
- Keep source adapters separate from canonical domain models and UI.
- Derived metrics must be deterministic, versioned, documented and tested.
- Forecasts/models must be separated from official facts and must expose uncertainty/method/version.
- Do not publish person, minister, cabinet-post or party-leader odds without a separately sourced, backtested and documented model.
- Do not require an account for initial public browsing.
- Do not prioritize Stripe/auth/paywall before charts/data/party/maps/indicators/simulator.
- Real party logos are mandatory; use local assets and record provenance.
- All major UI must work on phone, tablet, laptop and wide desktop.
- Do not rely on hover for essential interactions.
- Stay politically neutral and apply identical data rules to all parties.
- Do not rewrite sound existing architecture without a concrete reason.

## Delivery behavior
Work autonomously on routine engineering decisions. Inspect existing code first, then implement. Validate each meaningful milestone with the relevant install/build/typecheck/lint/tests before claiming completion. Keep documentation and methodology synchronized with behavior.

Canonical product specification: `README.md`
Detailed takeover plan: `CODEX_HANDOFF.md`
Canonical/public branch: `main`
Scoped feature branches: `codex/*`

## Current implementation rules

- Keep Swedish default pages and English `/en/` pages complete and separate. Localize server text before serialization, and preserve machine keys, URLs and numeric inputs. Verify hydration and interactive error states in both languages.
- The `live-data` branch publishes only the verified 2026 live JSON; never merge it into `main`. Preserve independent preliminary/final-count snapshots and the last verified data on source failure. Never publish rehearsal data as production results.
- Keep the pinned Valmyndigheten certificate, preparation manifests, phase/identity checks and official arithmetic checks intact. A source or certificate change requires review and regression coverage. Follow `docs/operations/election-night-2026.md`.

- The downloaded Valmyndigheten workbook is intentionally untracked. Regenerate normalized outputs with `npm run data:import` and verify them with `npm run data:verify`.
- Keep the accepted SwedishPolls CSV snapshot tracked with its source commit, row count, dates, cross-checks and SHA-256 in `data/raw/polls/source-manifest.json`.
- Preserve reviewed publication-date corrections in `lib/forecast/source-corrections.ts`, with primary sources and adapter version in the public forecast. Never edit the immutable upstream CSV to conceal a correction.
- Historical forecast windows move with the current horizon. Validate their cutoffs, poll/house counts and frozen year/role split against eligible input rows; never freeze moving counts to one release.
- Forecast v1 beta is frozen at a 180-day window and 28-day half-life, calibrated on 2010–2018 with 2022 as the locked holdout. Do not silently retune it.
- Regenerate the forecast with `npm run data:forecast:generate`. Use `npm run data:polls:update` for the validated upstream refresh; a rejected source must leave the last-known-good snapshot intact.
- Keep `docs/methodology/forecast-v1.md`, `docs/data-sources/opinion-polls.md` and the implementation synchronized.
- Government-formation statements belong in `data/context/government-formation-2026.json` with dated sources and DECLARED/CONTEXT labels; the poll refresh must not rewrite them.
- Preserve URLs, retrieval dates, expected official totals and checksums in `data/raw/valmyndigheten/source-manifest.json`.
- Preserve all 21 GIS archive URLs/checksums and the normalized geometry checksum in `data/raw/valmyndigheten/geography-source-manifest.json`; never mix 2022 results with silently substituted 2026 boundaries.
- Preserve the historical mandate inputs, official expected outcomes, 2026 fixed-seat structure and normalized checksum in `data/raw/valmyndigheten/seat-source-manifest.json`; regenerate with `npm run data:import:seats`.
- Keep the canonical party registry in `lib/parties.ts`; source-name mappings belong in the Valmyndigheten adapter layer.
- Do not replace local party assets without updating `docs/data-sources/party-assets.md` with the new source, date and SHA-256.
- Version indicator behavior and keep `docs/methodology/indicators-v1.md` synchronized with calculations.
- Version simulator rules and assumptions, keep `docs/methodology/simulator-v1.md` synchronized, and retain exact historical mandate backtests.
- Run `npm run data:verify` and `npm run check` before handoff. Keep this file, `README.md` and `CODEX_HANDOFF.md` aligned with implementation reality.

## Runtime isolation

- Run the development server only through `npm run dev`; its preflight must pass before Next.js starts.
- Local development is fixed to `127.0.0.1:4317`. Do not use automatic port fallback, `0.0.0.0`, ports `3000`, `3001`, `3100`, `8000` or `8790`, or a port referenced by a local tunnel/service definition.
- The preflight must verify the package, repository root, GitHub remote, an allowed `main`, `agent/foundation` or `codex/*` branch, free port and absence of a tunnel/service route to the development port.
- Do not modify other repositories, `~/Library/Application Support/WilliamRydhRadio`, launchd jobs, tunnels, DNS, Cloudflare configuration or unrelated domains while working on Politicalverse.
- Politicalverse publishes only through the repository's GitHub Pages workflow at `https://willrydh.github.io/Into-The-Politicalverse/`. Do not reuse another project's hosting target or domain.
- Browser QA must use a new temporary tab pointed explicitly at the fixed loopback URL or the Politicalverse GitHub Pages URL and close it after verification.
