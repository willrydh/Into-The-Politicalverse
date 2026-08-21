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
