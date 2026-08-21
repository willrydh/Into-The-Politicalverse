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
2. Add CI.
3. Connect real historical Valmyndigheten election data through a source adapter.
4. Replace placeholder UI data with a real responsive historical Riksdag chart.
5. Add real official party logos stored locally with provenance.
6. Build Party Explorer.
7. Add geography/maps.
8. Add tested derived indicators.
9. Add a deterministic Swedish election simulator and backtest it.
10. Only after the public analytical product is useful, consider auth/paywall.

## Hard rules
- Never present invented/demo values as real election data.
- Every quantitative output must be clearly classifiable as OFFICIAL, DERIVED or MODEL.
- Valmyndigheten is the primary authority for official Swedish election data.
- SCB PxWeb is the initial authority for aggregate socioeconomic/demographic context.
- Preserve source provenance and freshness metadata.
- Keep source adapters separate from canonical domain models and UI.
- Derived metrics must be deterministic, versioned, documented and tested.
- Forecasts/models must be separated from official facts and must expose uncertainty/method/version.
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
Current working branch: `agent/foundation`
Current draft PR: `#1 Build Politicalverse foundation`

## Current implementation rules

- The downloaded Valmyndigheten workbook is intentionally untracked. Regenerate normalized outputs with `npm run data:import` and verify them with `npm run data:verify`.
- Preserve URLs, retrieval dates, expected official totals and checksums in `data/raw/valmyndigheten/source-manifest.json`.
- Preserve all 21 GIS archive URLs/checksums and the normalized geometry checksum in `data/raw/valmyndigheten/geography-source-manifest.json`; never mix 2022 results with silently substituted 2026 boundaries.
- Keep the canonical party registry in `lib/parties.ts`; source-name mappings belong in the Valmyndigheten adapter layer.
- Do not replace local party assets without updating `docs/data-sources/party-assets.md` with the new source, date and SHA-256.
- Version indicator behavior and keep `docs/methodology/indicators-v1.md` synchronized with calculations.
- Run `npm run data:verify` and `npm run check` before handoff. Keep this file, `README.md` and `CODEX_HANDOFF.md` aligned with implementation reality.

## Runtime isolation

- Run the development server only through `npm run dev`; its preflight must pass before Next.js starts.
- Local development is fixed to `127.0.0.1:4317`. Do not use automatic port fallback, `0.0.0.0`, ports `3000`, `3001`, `3100`, `8000` or `8790`, or a port referenced by a local tunnel/service definition.
- The preflight must verify the package, repository root, GitHub remote, `agent/foundation` branch, free port and absence of a tunnel/service route to the development port.
- Do not modify other repositories, `~/Library/Application Support/WilliamRydhRadio`, launchd jobs, tunnels, DNS, Cloudflare configuration or unrelated domains while working on Politicalverse.
- No Politicalverse hosting target currently exists. Do not deploy to or reuse another project's domain.
- Browser QA must use a new temporary tab pointed explicitly at the fixed loopback URL and close it after verification.
