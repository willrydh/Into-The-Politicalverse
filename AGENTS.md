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
- Use official local party logos on dedicated identity surfaces: party cards, leader headers, selectors and result rows. Preserve asset provenance.
- Project branding uses the owner-supplied crown, separate from party identities. Keep header/footer, both languages, sharing metadata, favicons and home-screen manifests synchronized with the versioned originals in `docs/brand/README.md`.
- Use names or abbreviations in prose, sentence headings, dense chart labels and inline candidate changes. Shared party groups default to text; opt into logos only for dedicated identity panels. Other/local parties remain text. Keep full accessible names and native select labels; never substitute party tokens inside personal names or machine values. See `docs/data-sources/party-assets.md`.
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

- Keep the central mandate comparison facing inward: both blocs' logos, seat totals and captions align toward the middle majority marker on all screen sizes.
- Sort table rows using explicit source values before pagination or top-N limits. Keep unavailable values last in both directions, stable ties and original leaderboard ranks. Preserve chart chronology, accessible column buttons, localized sort labels and the mobile equivalents for card layouts.
- Align sortable headings with their column contents. Reset leaderboard column sorting and pagination whenever its metric, filters or candidate search change; never retain an earlier manual sort when returning to a previous selection.
- Adding data is not authorization to redesign the leaderboard. Preserve its original desktop columns and density. The owner explicitly requested a mobile redesign on 8 September: compact selection and explanations, paired election-year votes/list positions, and the selected comparison prominently displayed. Keep mobile name, geography and party together; share-point rankings must emphasize share points, not percentage vote change. Ballot positions are compact secondary text under existing vote counts, always on one line with ellipsis when needed. Do not show counts such as "2 valsedlar" in the collapsed row; full list details expand on demand.
- Preserve official printed ballot positions for each result and its prior-election comparison. Historical XML `KANDIDAT` is the printed position; its `ORDNING` is vote ordering. Retain all distinct list-number/position pairs in administrative aggregates, display multiple positions explicitly, and never substitute leaderboard/seat rank or an average/best position. Keep the explanatory distinction between an observed change and a causal effect of list placement.
- Keep candidate-profile PocketPolitics referrals distinct from official sources. State the verified demo scope and access terms; never imply a matched personal profile or national coverage without evidence. See `docs/operations/pocketpolitics-referral.md`.
- Preserve the pre-election reference checksum and freeze boundary. Never create a reference retrospectively or grade a partial count as final. Stage 2026 personal votes separately; enabling a new history year still requires verified geography, source coverage and conservative identity linking. See `docs/operations/election-transition-2026.md`.


- Candidate histories use election-scoped source numbers and the versioned full-name/age/municipality linker. Never force name-only identity matches or infer membership dates from a changed party candidature. Preserve normalized gzip checksums, re-run flags, actual-party denominators, source municipality membership for constituency comparisons, and null/zero distinctions. Every change compares the same election type and area four years earlier. Keep the compact candidate search and profile shards out of shared header bundles. See `docs/methodology/candidate-history-v1.md` and `docs/data-sources/candidate-history.md`.


- Universal search must rebuild from verified source identities and current page text, preserve bilingual URLs and exact party/candidate/constituency scope, and validate public payloads before showing results. Keep the index out of the shared header bundle. SCB locality links open municipality results with explicit scope; never infer district geometry or votes from a locality name. Preserve split localities and normalized/source checksums. See `docs/data-sources/universal-search.md`.

- The historical archive must distinguish largest party, year-specific bloc seat totals and the first government following the election. Use reviewed `election-outcomes.json` context, never infer government from vote-share rank. Preserve 349-seat coverage, the 175-seat threshold, separate cabinet/support parties and the 2018 election versus January 2019 formation. See `docs/methodology/election-outcomes-v1.md`.

- Preserve the scroll-aware header and localized location trail. Keep the sliding surface free of an outer shadow and shadow fade. The map owns geographic breadcrumb names; do not infer labels from codes or leave a previous page's location visible after navigation. Verify downward hiding, upward reveal, keyboard access and mobile menu visibility.
- Preserve the full-screen PWA viewport in both language roots and the 404. Keep top safe-area spacing on the disappearing header, with no permanent body top inset. Check menu/footer safety, status-icon contrast and actual installed iPhone behavior separately from browser viewport emulation.
- The header uses the owner-supplied CodePen direction slide. On desktop, native sticky positioning scrolls branding away first; upward scrolling reveals navigation and the location trail. On mobile, upward scrolling returns the original logo/language/theme/Menu toolbar; breadcrumbs remain in normal page flow near the top. Keep one moving surface per breakpoint and the same 0.3-second transform transition in both directions. Do not restore moving document anchors, spacer/margin balancing or display-mode swaps. Preserve menu/keyboard access, reduced motion and safe-area padding on the moving surface. Verify slow reversals and keep native iPhone acceptance separate. See `docs/operations/header-motion.md`.

- The local explorer uses 21 administrative counties, 290 municipalities and 2022 district boundaries; never substitute Riksdag constituency codes for county codes. Retain exact municipality-to-constituency links for candidate tables.
- Keep local history and personal-vote source/output checksums, the four official GIS name fallbacks and the two ambiguous shared-baseline district cases. Only verified district comparisons can produce 2018 history or swing. See `docs/data-sources/local-election-geography.md`.
- Include collection votes exactly once in higher-level totals, without mapping them onto physical districts or treating them all as overseas votes. An absent electorate or unavailable history is null, not zero.
- Personal-vote data is election/party/candidate/constituency scoped. Sum distinct ballot-list counts, use the actual party's votes as denominator, and never mislabel constituency personal votes as municipal/district observations. Reaching the 5% threshold is not proof of election.
- Personal-vote navigation must expose all constituencies in the selected county even within a municipality/district. Default to the area's actual constituency, identify the separate scope when another is selected, and clear the override on geographic navigation while preserving it across language/history changes.
- Keep local APIs static and `.json`-suffixed, validate detail payloads, preserve query state on language changes, and verify failure/retry behavior. These imports must not modify forecast parameters or the independent 2026 live feed.

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
- Do not modify other repositories, `~/Library/Application Support/WilliamRydhRadio`, launchd jobs, tunnels or unrelated domains while working on Politicalverse.
- The owner authorized migration of `politicalverse.se` from Loopia DNS to its own Cloudflare zone. Public static releases remain on this repository's GitHub Pages workflow, using the custom domain and root base path. Cloudflare routes only `/admin*` and `/insights/*` to `politicalverse-insights`, with its own EU D1 database. Do not reuse another project's hosting target, secrets, database or domain. Keep DNSSEC enabled after migration.
- The isolated Worker integration suite may bind only `127.0.0.1:4317`, with in-memory test data and no concurrent Next development server. Never run tests against the production database.
- Analytics starts after explicit consent. Use only the approved closed route/event vocabulary; no search text, candidate or party selections, raw referrer URLs or visitor IPs in statistics. All admin endpoints require server-side sessions. Keep encrypted secrets out of static exports and source control. See `docs/operations/insights.md`.
- Browser QA must use a new temporary tab pointed explicitly at the fixed loopback URL or `https://politicalverse.se/` or the Politicalverse GitHub Pages URL and close it after verification.
