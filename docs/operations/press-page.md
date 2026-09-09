# Press page and attribution

Owner request: 9 September 2026. Public routes: `/press/` and `/en/press/`.

Politicalverse is provided free to everyone, forever, by William Rydh. Reuse of site material, data, text, images or insights requires crediting Politicalverse, including previously used material. A link to the relevant page is appreciated wherever practical. This is the owner's product and reuse policy; do not substitute a Creative Commons license or impose a permission-request process. Original data source references and source-specific terms remain intact. The former paid-Pro/paywall roadmap is superseded in README, AGENTS and the handoff.

The server-rendered page contains product purpose, audiences, capabilities, sources, update behavior, attribution, original logo downloads and a PocketPolitics referral. Swedish and English copy is explicit; language changes retain the route. Metadata, bilingual sitemap URLs, search validation/indexing, footer links and the location trail include press. Scoped CSS uses the existing palette and shared crown hero; no analytics integration or header-motion change is part of this release.

## Evidence used for the copy

- Valmyndigheten: imported election, personal-vote, ballot-position and geography manifests; `docs/data-sources/candidate-history.md` and `local-election-geography.md`. Preserve the actual result area and conservative person links.
- Polling: `docs/data-sources/opinion-polls.md`, the source manifest and `.github/workflows/data-refresh.yml`. The six-hour schedule checks the accepted SwedishPolls source; it is not a direct live integration with every institute. After election day, retain the pre-election forecast.
- SCB: `docs/data-sources/universal-search.md` and the locality source manifest. Connected locality names and municipality membership must not be described as locality-level vote counts or a live demographic pipeline.
- Election night: `.github/workflows/election-live.yml`, `docs/operations/election-night-2026.md` and `election-transition-2026.md`. Five-minute collection is best-effort during 13–30 September 2026, followed by daily October–December checks. Browser refresh is not a guarantee of new source observations. Rehearsal validation is distinct from real production acceptance, and final forecast grading requires complete final results.
- Brand downloads: existing `public/brand/crown-2026/politicalverse-logo.svg` and `politicalverse-app-icon-1024.png`. Retain original colours and proportions; do not regenerate the mark.
- PocketPolitics: use the existing localized referral component and exact `https://pocketpolitics.io/welcome` URL. Its Marks kommun demo, subscription for full access and separate-product identity remain explicit. See `pocketpolitics-referral.md`. No candidate-specific link, imported script or iframe is added.

Keep press copy synchronized when source coverage, schedules or product behavior changes. Do not copy a current forecast percentage, personal-vote count or provisional result into this evergreen description. The free-access promise applies to Politicalverse; it does not imply free PocketPolitics subscriptions.
