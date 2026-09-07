# Candidate history source catalogue

Publisher: Valmyndigheten. Retrieved 7 September 2026. Manifest: `data/raw/valmyndigheten/candidate-history-source-manifest.json`. This is historical final-result data, not a live 2026 candidate/result feed.

## Party-code correction, 7 September 2026

The original 2010, 2014 and 2018 `slutresultat_00R.xml` files identify MP and KD through ballot lists beginning `0055-` and `0068-`. The 2022 `kandidaturer.csv` in the pinned candidate ZIP confirms these identities in `PARTIBETECKNING`, `PARTIFÖRKORTNING` and `PARTIKOD`. The 1.0.1 importer fixes its former `0053`/`0077` mapping and checks recognized historical parties against every available ballot-list prefix.

All four outputs were regenerated from the existing verified originals and checked against an expected transformation limited to those party codes/identities and the method version. No vote counts, denominators, source names, ages, geography or candidate links changed. This gives MP/KD candidates the right logos, party filters and search identity, and removes false party-change indicators between 2018 and 2022. Previous output hashes remain in the manifest’s normalization-correction record.

## Historical names and vote counts

The original final XML ZIP archives for 2010, 2014 and 2018 contain source names, election-scoped candidate numbers, personal votes, ballot lists, party votes and election geography for all three election types. Some currently served historical pages have had names removed. The importer uses preserved **original Valmyndigheten archives**, not search snippets or invented identities:

- [2010 original archive, preserved 18 November 2016](https://web.archive.org/web/20161118213230id_/http://www.val.se/val/val2010/slutresultat/slutresultat.zip)
- [2014 original archive, preserved 26 September 2021](https://web.archive.org/web/20210926131036id_/https://data.val.se/val/val2014/slutresultat/slutresultat.zip)
- [2018 original archive, preserved 26 September 2021](https://web.archive.org/web/20210926125427id_/https://data.val.se/val/val2018/slutresultat/slutresultat.zip)

`slutresultat_00R.xml` contains Riksdag constituency totals, `slutresultat_00L.xml` regional constituencies, and 290 `slutresultat_<municipality>K.xml` files contain municipal constituencies. `slutresultat_00K.xml` supplies the national municipal control total. Small parties nested under `ÖVRIGA_GILTIGA` are included individually; the aggregate container is never counted as another party.

Party-level `PERSONVAL` and ballot-level `PERSONVAL` are two representations of the same votes. Group the direct rows by election candidate number and reconcile with distinct ballot-list/position rows. Source spelling variants can split a direct candidate aggregate (for example Clas/Claes Sundberg, SD, regional constituency 2303 in 2010); retain the aliases and reconcile the combined count. Never drop one spelling or count both representations twice. Missing result rows do not prove zero votes or no candidacy.

Name/age/municipality evidence also comes from the pinned 2010 personal-vote CSV, 2014 R/K/L ballot CSVs, and 2018/2022 complete candidacy CSVs. Some names are removed in current historical metadata, but candidate numbers, age and candidacy location remain useful when joined **within the same election** to the original result archive. Sources and hashes are all in the manifest; ages are used for cautious linkage, not exposed as an inferred exact birth date.

## 2022

The source is Valmyndigheten’s combined `Personroster-i-val-till-riksdagen-region-och-kommunfullmaktige-2022.xlsx` (`Rådata`). Party denominators come from the official RD, RF and KF district-result workbooks. Sum valid party votes across all districts, including collection districts exactly once; do not use personal-vote totals as the denominator. The raw sheets also have summary and invalid-ballot rows; these are not party observations.

The two official 2022 files differ in one reviewed local-party spelling: personal-vote `SOS-Ställ Om Sverige, Söderhamnsinitiativet` versus result `SOS-Ställ Om Sverige  Söderhamnsinitiativet` (party 1360, municipality 2182). The importer has an explicit alias; it does not fuzzy-match all party names. Local party-name lookup is scoped to election and municipality/region, because the same text can identify different local parties.

Pinned personal-vote totals (all parties):

| Year | RD | RF | KF |
|---|---:|---:|---:|
| 2010 | 1,494,924 | 1,422,296 | 1,848,627 |
| 2014 | 1,531,582 | 1,392,830 | 1,802,924 |
| 2018 | 1,558,561 | 1,390,319 | 1,802,477 |
| 2022 | 1,457,836 | 1,304,159 | 1,656,282 |

Historical anchors are the national XML attributes. The 2022 anchors are pinned sums of the official combined personal-vote workbook; valid-ballot totals come from the separate district-result files. Existing 2022 RD candidate counts and denominators are additionally matched record for record against the previously verified import.

## Reproduction and delivery

1. `npm run data:import:candidates` uses Python 3’s standard library only. It downloads missing files from the manifest, rejects changed source hashes, and reconciles source totals. Raw downloads stay ignored.
2. Normalized `candidate-elections-<year>.json.gz` snapshots are tracked with hashes. Compression has fixed timestamps. A changed normalized result requires review and deliberate manifest update; do not automatically accept source/output changes.
3. `npm run data:build:candidates` deterministically creates the ignored `public/api/candidates/` tree. It runs before development and both build commands. There is no server dependency at runtime: a catalog below 50 KB (area labels and source metadata only), 256 profile shards, year/election ranking files, year/constituency map files and one compact candidate-search catalogue are exported as `.json`.
4. `npm run data:verify`, `npm run check` and `npm run build:pages` gate publication. Profiles are loaded one shard at a time. Candidate search uses dictionaries instead of sending every full vote history to the search page, and is kept out of the shared header bundle. Exact-name ties in search prefer more recent and more complete histories using the same bounded recency rule for every party; this never overrides a better textual match. Client payloads validate shape, scope and arithmetic before rendering.

Coverage after the first import: 207,104 election identities, 142,108 derived/source profiles, and 41,206 profiles linked across multiple elections. A profile count is **not** a verified count of distinct lifetime persons. Full identity coverage is intentionally not claimed. See [the methodology](../methodology/candidate-history-v1.md) for matching rules, geography checks and gaps.
