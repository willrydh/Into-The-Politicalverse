# Valmyndigheten national Riksdag history — 2002–2022

Last verified: **2026-08-21**

## Scope and authority

Politicalverse publishes the final national Riksdag result for the six general elections held in 2002, 2006, 2010, 2014, 2018 and 2022. Every observation is classified **OFFICIAL** and comes from Valmyndigheten.

The exact source URL for each election is pinned in [`data/raw/valmyndigheten/source-manifest.json`](../../data/raw/valmyndigheten/source-manifest.json). The normalized series is generated as [`data/normalized/riksdag-national-history.json`](../../data/normalized/riksdag-national-history.json).

## Canonical party buckets

The historical adapter retains the eight present parliamentary parties and one combined `OTHER` bucket. Folkpartiet liberalerna is normalized to the stable `L` identifier used by Liberalerna.

The 2002 presentation lists Sverigedemokraterna inside Valmyndigheten's detailed breakdown of `ÖVR`. Politicalverse uses the official **76,300** SD votes as `SD`; `OTHER` is the exact remainder of the official valid-vote total after the eight canonical party counts, **89,090** votes. This is a grouping normalization, not an estimate.

Vote shares are validated by recalculating each value from official party votes divided by official valid votes and rounding to two decimals. Every election must contain all nine canonical buckets and party votes must reconcile exactly to the official valid-vote total before import succeeds.

## Official totals

| Election | Valid votes | Total votes | Eligible voters | Turnout |
| --- | ---: | ---: | ---: | ---: |
| 2002 | 5,303,212 | 5,385,430 | 6,722,176 | 80.11% |
| 2006 | 5,551,278 | 5,650,416 | 6,892,009 | 81.99% |
| 2010 | 5,960,408 | 6,028,682 | 7,123,651 | 84.63% |
| 2014 | 6,231,573 | 6,290,016 | 7,330,432 | 85.81% |
| 2018 | 6,476,725 | 6,535,271 | 7,495,936 | 87.18% |
| 2022 | 6,477,970 | 6,547,801 | 7,775,390 | 84.21% |

Regenerate the normalized series with `npm run data:import`, then run `npm run data:verify`.
