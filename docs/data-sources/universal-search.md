# Universal search v1

The shared header links to `/search/` (Swedish) or `/en/search/` (English), with
⌘/Ctrl K focusing search. The static `/api/search/index.json` endpoint is rebuilt
on every site build. It is downloaded only on the search page; no search phrase
is sent to a search provider or analytics service. Queries, filters and pagination
are ordinary shareable URL state, retained on reload, browser back and language changes.

## Coverage and destination scope

- All public product pages and their component text literals are indexed in both
  languages at build time. The page registry is checked against the locale route
  registry. Reviewed topics, source-catalogue entries, election years, prime
  ministers and dated government context have direct section links.
- Eight parliamentary parties link to their selected Party Explorer profile.
- 21 counties, 290 municipalities, 6,264 physical districts and 290 collection
  groups use exact Valmyndigheten codes. Collection groups remain non-spatial.
- All 5,948 candidate/party identities from the final 2022 personal-vote dataset
  appear once, with all 13,775 constituency relations available. Links carry the
  source party code, candidate ID, canonical party, constituency and year. These
  are **2022 personal-vote records**, not 2026 candidacies. No candidate vote
  totals are combined by search, and no elected status is inferred.
- Changing map geography, party or constituency clears the candidate override.
  Language changes and history preserve it. Invalid or missing candidates cannot
  silently display another person's votes as the selected person's result.

## SCB named urban localities

Primary catalogue: https://www.scb.se/hitta-statistik/statistik-efter-amne/boende-bebyggelse-och-mark/bebyggelseomraden/tatorter-och-smaorter/

Workbook: https://www.scb.se/contentassets/b7f6aeab34344238b4c4573620ff76c9/mi0810_2023_tatorter2023_kommun_bef_area_v3.xlsx

Retrieved 7 September 2026. The statistical geography is **2023**; the workbook
records names revised by Lantmäteriet on **24 November 2025**. It contains 2,017
unique locality codes and 2,144 exact municipality relations, including 104
localities in multiple municipalities. Stockholm has 12 municipality relations.
All relations are preserved, including those with no published population value.

Only locality identity and municipality membership are imported. Population,
geometry and election totals are not inferred. A locality result explicitly
links to the relevant municipality's election view; the two boundaries differ.
For example, Fritsla is `1463TB104` and links to Mark municipality `1463`.
Current SCB smaller-locality data does not contain names, so this release does
not invent a named small-settlement register. Names in election districts remain
searchable independently.

Raw SHA-256: `d743b0df767ee267e715545e4809c0ea51c5102d56af12088183a9610e6793e9`.
`data/raw/scb/localities-source-manifest.json` pins both source and normalized
checksums. Reproduce with `npm run data:import:localities`; `-- --local` uses the
verified ignored workbook. Unexpected bytes/schema/counts/municipality joins
fail before accepted normalized data is replaced. `data:verify` checks the
normalized hash, coverage, source metadata and search index.

## Matching and validation

Search normalizes Unicode, case, accents, punctuation and whitespace. Every query
word must match; exact titles, name tokens and prefixes rank ahead of context.
Exact party abbreviations receive explicit priority, under identical party rules.
Names are ordered alphabetically when relevance ties. No popularity, voting
strength, inferred political preference or personal search history affects rank.
When no exact matches exist, one-character name spelling suggestions are visibly
labelled. Short tokens and numeric codes never use this fallback.

Filters retain counts for all categories. Results are paginated 24 at a time.
The roughly 0.5 MB gzip index is lazy-loaded and schema/URL validated; bad payloads
or request failures show a localized retry state. No old result is attributed to
a failed new payload. Tests cover full candidate/destination joins, all geography
links, split localities, languages, matching, approximate matches, empty results,
malicious payloads, duplicate IDs and the transfer budget.
