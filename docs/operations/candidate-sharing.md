# Candidate-specific social previews

Each existing `/people/?person=…&election=…&area=…` URL and its `/en/` equivalent receives candidate-specific metadata at the Cloudflare edge. `politicalverse-sharing` is a separate public Worker; it has no database, secrets, visitor tracking or connection to the private insights Worker. The visible profile and other site routes remain the static Next export on GitHub Pages.

The 1200 × 630 PNG contains the candidate's name, year-appropriate party abbreviation (local parties retain their names), official personal votes, calculated percentage vote change, exact election/area/year, a small history graph and the owner-supplied crown. Swedish and English images are separate. Official vote counts and derived change are labelled separately. Missing comparisons show a dash and a reason. Zero votes remain zero; missing or ambiguous history points remain missing. Graph segments connect only comparable adjacent elections, never across changed boundaries or re-runs. Party changes remain visible and do not imply membership dates or causation.

## Data and future elections

`selectCandidateProfile` is shared by the client profile and the sharing-data build. It preserves the existing default election (municipal when available), area selection and latest-result panel. A leaderboard `year` query affects profile standings; it does not silently change the current result shown in the card. Different election types/areas are never summed together for a sharing image.

Every candidate prebuild creates `api/candidates/sharing-v1/{00…ff}.json` from the same verified histories. Every profile has a content hash covering its actual name, scopes, results and graph. The public contract and renderer have no fixed list of election years. When an accepted 2026 (and later 2030) history is promoted through the existing import/identity/geography gates, an ordinary Pages release rebuilds these files. The Worker then selects the latest result and the same four-year comparison without a Worker deployment or manual image generation.

Only final official history is accepted by this release. The build explicitly rejects source snapshots whose `status` is not `final`; the Worker independently rejects preliminary sharing payloads. The separate election-night feed and staged personal votes do not enter these cards. Do not relabel partial results as final, enable a history year without source verification, force identity links or manufacture zero baselines. See [2026 transition](election-transition-2026.md). Future preliminary profile support would require an explicit phase-aware contract and labels, not removal of this gate.

## Cache and metadata

- Profile HTML is revalidated on each request. Existing generic title/description, canonical, alternate and OG/Twitter tags are replaced once in the streamed head. The body, scripts, viewport and app icons are preserved. A small synchronous script restores the original static head during HTML parsing, before React hydration. Crawlers receive the candidate metadata in the raw HTML; React receives the original nodes it expects. After hydration, the profile client updates existing head attributes with the same shared descriptor and SHA-256 revision. No React-owned nodes are deleted and no mutation observer is used. This also follows query/language changes, restores metadata on unmount and adds no extra data fetch. Canonical and bilingual alternate URLs include the resolved person/election/area.
- Public sharing shards refresh at most once per minute per edge location and shard, using a minute bucket to bypass the longer upstream static-asset TTL. Fetches are same-origin, bounded to 4 MiB and time out; no browser cookies or authentication headers are forwarded to them.
- Image URLs include the person's content revision, selected scope, locale and design version. Image lookup first resolves the current published data, before consulting the rendered PNG cache. An old image URL redirects without caching to the latest revision. Images have a five-minute browser TTL; keyed edge copies last up to one day. A corrected count changes the revision just as a new election does.
- Do not promise to modify already-published posts: social networks maintain their own preview caches and may require a fresh crawl. Politicalverse returns current metadata on the next crawl; it cannot purge another platform's cache.
- Invalid image URLs return 404. Unavailable/malformed data returns an uncached 503 for images. Metadata-source failures retain the working static profile without invented candidate data. Generic profile routes, RSC payloads and non-profile assets pass through.

## Rendering assets

Artwork: unchanged `public/brand/crown-2026/politicalverse-logo.svg`, with provenance in [branding](../brand/README.md). Text uses Inter from the pinned `@fontsource/inter` package under its SIL Open Font License (`node_modules/@fontsource/inter/LICENSE`). Only redistributable fonts are bundled; no local system fonts are distributed. Satori is pinned to the Worker-compatible standalone 0.32.0 release (the later HarfBuzz loader depends on browser/Node initialization). It converts the layout to SVG using bundled Yoga Wasm; resvg converts it to PNG. All assets ship with the Worker, with no third-party font/image requests during rendering.

Primary references: [Cloudflare routes and origin fetch](https://developers.cloudflare.com/workers/configuration/routing/routes/), [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/), [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), [Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/), [Satori](https://github.com/vercel/satori), [resvg](https://github.com/thx/resvg-js).

## Verification and release

Run `npm run data:verify` and `npm run check`. The sharing suite bundles the actual Worker and uses only `127.0.0.1:4317`, without a concurrent Next dev server. It checks raw crawler HTML, real 1200 × 630 PNG bytes, source failures, query injection, canonical/localized URLs, cache hits and invalidation after new elections and count corrections. Synthetic future observations exist only in tests and are never written to public data. Review generated real-candidate PNGs under `.wrangler/sharing-test-bundle/` visually.

Publish the accepted Pages build first so the sharing shards exist. Then, from the same reviewed revision:

```sh
npx wrangler types --config workers/sharing/wrangler.jsonc workers/sharing/worker-configuration.d.ts
npx wrangler deploy --dry-run --config workers/sharing/wrangler.jsonc
npx wrangler deploy --config workers/sharing/wrangler.jsonc
```

Only `politicalverse.se/people*`, `/en/people*` and `/share/candidate/*` belong to this Worker. It rewrites exact profile paths only. Worker releases are explicit; Pages/data-refresh releases include its tests but do not redeploy it. Recheck raw production HTML as a social crawler and download/decode the actual linked PNG. Verify a generic page and the profile UI still work. Roll back only the sharing Worker if rendering fails; never change DNS, the insights Worker or election data to repair an image.

## Profile standings on sharing cards

Cards show up to five distinct placements for the selected standings year, across the person's available elections, geographic cohorts and all-party/within-party comparisons. National placements come first, then placements in the profile's selected election/area; within that priority, all-party cohorts precede party-only cohorts, then better ranks and larger cohorts. The same deterministic rule applies to every candidate. More than five are labelled “Utvalda placeringar”. Profiles with none retain the full history graphic.

Repeated national/county RD total-vote ranks are deduplicated across constituency records. Municipal/regional observations are never merged across areas, even for votes. Changes and shares remain tied to their actual result area, including when their comparison cohort is national; do not deduplicate different constituency observations or imply one national personal-vote percentage. Keep competition ties and the existing `standingLabel`: exact #1–#49, Topp 50 at #50, Topp 100 at #51–#100. No rank is inferred from the person's own vote count or printed ballot position.

Placements use two columns with regular-weight metric labels and at most three entries per column. Exact/high ranks lead and broader top-100 mentions sit on the right where possible. Placement text stays compact (for example “Riksdag · Svenska moderater”). Use the full source names internally, conventional VG/Skåne geographic shortening on the image and explicit ellipsis for unusually long local-party names. If all selected placements use one metric, name that metric once above the list. Full context and methodology remain on the profile. The headline vote/change panel still uses the latest result, while the placement section explicitly states its own year.

The image Worker reads the existing validated public standings shard, with the same method and source version as the sharing data. Missing/mismatched source generations return a retryable response rather than fabricated or mixed ranks. Browser sharing adds no data request: it derives the same selection and revision from the already loaded candidate and source version. Image URLs/ETags include the complete source version and leaderboard method, so a correction to another candidate that changes this person's rank also invalidates the cached image. The card design is versioned as candidate-card-2.
