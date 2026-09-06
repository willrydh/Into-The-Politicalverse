# Local Riksdag results and personal votes

Reviewed and retrieved on 6 September 2026. Publisher: Valmyndigheten. Sources are open data with attribution. The local explorer covers **Riksdag elections**, not municipal council or regional council results.

## Coverage

| Level | History | Presentation |
| --- | --- | --- |
| Sweden, 21 administrative counties, 290 municipalities | 2010, 2014, 2018, 2022 | Official counts, calculated shares, turnout and history |
| 6,264 physical 2022 electoral districts | 2022; 2018 for 4,162 verified comparisons | Official counts, district map and comparable history |
| Collection districts | 2018 and 2022, summed per municipality | Separate list row, no polygon or artificial turnout |
| Personal votes | 2022, all 29 Riksdag constituencies | Candidates, all-list personal-vote totals, percentage of the party's votes |

Administrative counties are not Riksdag constituencies. Stockholm county includes constituencies 01 and 02; Västra Götaland includes five constituencies. Every municipality and physical district retains its constituency from the 2022 vote workbook. Borås (1490) belongs to constituency 19. Candidate tables always name the constituency explicitly, even when opened from a municipal or district profile.

## Reproducible sources

The [historical source catalogue](https://www.val.se/valresultat-och-statistik/statistik-och-data/radata-fran-val-2002-2022) links the final 2022 vote workbook, district comparison workbook, county GIS archives and personal-vote workbook. Historical municipality files:

- [2010 municipality results](https://historik.val.se/val/val2010/statistik/slutligt_valresultat_kommuner_R.skv), Windows-1252, semicolon-delimited;
- [2014 municipality results](https://historik.val.se/val/val2014/statistik/2014_riksdagsval_per_kommun.skv), the same legacy format; FP maps to L;
- [2018 district results](https://historik.val.se/val/val2018/statistik/2018_R_per_valdistrikt.xlsx), `R antal`; checked against the existing 2018 municipality snapshot;
- [2018–2022 district comparisons](https://www.val.se/download/18.162047b519a91d0533119148/1666857349837/jamforelser-2018-och-2022-valdistrikt-och-uppsamlingsdistrikt-v2.xlsx), `Fysiska valdistrikt`;
- [2022 personal votes](https://www.val.se/download/18.162047b519a91d0533118f73/1667212068773/Personroster-i-val-till-riksdagen-region-och-kommunfullmaktige-2022.xlsx), `Rådata`, only `Valtyp=RD`.

Pinned URLs, SHA-256, retrieval date, output hashes and reviewed name fallbacks are in `data/raw/valmyndigheten/local-geography-source-manifest.json` and `personal-votes-source-manifest.json`. The existing final-result and 21 county GIS manifests remain unchanged. Downloads stay ignored under `data/raw/downloads/local-geography/`.

```bash
npm run data:import:local
npm run data:import:personal
npm run data:verify
```

The import validates every source before emitting normalized products. Existing output hashes fail closed on an unexpected regeneration. Mapshaper 0.6.113 simplifies the original 2022 district geometry to 3% of removable vertices with `keep-shapes`, retains metre precision in SWEREF99 TM, and produces separate SVG paths fitted to each municipality. No 2026 geometry replaces historical boundaries. `POLITICALVERSE_MAPSHAPER_BIN` can select an existing installation of that exact version.

Four district names are blank in `roster_RD`: 01200503, 06430102, 06430107 and 06430108. Their official 2022 GIS names fill the missing labels by exact district code. The manifest records each fallback; no name is guessed from an earlier election.

## Comparability and arithmetic

Method `local-geography-1.0.0` uses vote counts throughout:

- Party share = party votes / all valid votes × 100. Invalid and blank ballots do not enter this denominator.
- Turnout = all ballots / eligible voters × 100. Zero electorate means unavailable, not 0% turnout.
- County counts are sums of their municipalities. Municipality and county percentages are never simple averages of smaller areas' percentages.
- Swing = 2022 exact share − 2018 exact share, calculated before display rounding. Parent-area differences use the same rule. Displayed percentages have two decimals; these exact-count differences can differ by 0.01 pp from subtraction of already-rounded display values elsewhere in the product. This version does not change the existing municipality-swing or forecast methods.
- Municipality and county history represents each year's administrative area. Identical official codes and names are required for the join, but historical values are not artificially redistributed over 2022 polygons. The map explicitly uses 2022 boundaries.
- District history uses only the authority's comparison key; matching codes or names alone never establish comparability. Where several old districts form one valid reference, counts and denominators are summed before percentages are calculated.

The authority marks 2,100 physical districts as not comparable. The source also maps both 25810005 and 25810006 to old district 25810529. Politicalverse retains both references but withholds their 2018 observations and swing as `shared-baseline`. That leaves 4,162 usable district histories; 2,102 physical districts have unavailable history. No estimates or zero-fill are substituted. The authority's comparison assessment allows limited boundary change, so “comparable” does not mean mathematically identical polygons.

## Overseas and late-counted votes

Accepted overseas votes are part of the official final results. Votes that reached polling stations in time are already in ordinary district counts. Late advance and overseas votes are also counted in collection districts. These collection rows are included **once** in municipality, county and national totals and are never redistributed back to map districts. Collection totals must not be labelled “overseas votes”: they also contain other late advance votes. See the authority's [preliminary-count explanation](https://www.val.se/det-svenska-valsystemet/rostrakning-och-mandatfordelning/preliminar-rostrakning).

The 314 source collection districts in 2022 contain 220,641 valid votes and 223,678 ballots. They become 290 municipal collection rows; all remain in the 6,477,970 valid national votes and 6,547,801 ballots. They have no separate electorate, so no collection turnout is displayed. Eligible voters abroad in the separate 2026 preparation dataset are people eligible to vote, not votes already cast.

The local historical explorer does not claim that 2026 votes are final or that all overseas votes are counted on election night. Its link to the independent live view preserves that view's preliminary/final-count and awaiting-results states.

## Personal votes

Method `personal-votes-1.0.0` retains election-scoped candidate ID, party code, party name and constituency. It combines distinct ballot-list rows for the same candidate, party and constituency; it rejects duplicate list/position rows. It never joins candidates across elections by name or sums a candidate's different constituencies into one eligibility test.

The workbook contains 14,172 RD rows, totaling 1,457,836 personal votes. These normalize to 13,775 candidate/party/constituency combinations. Other election types in the same workbook are excluded deliberately. Every party is retained, including minor parties displayed under the UI's “Other parties” filter with its actual party name and **its own** party-vote denominator.

The percentage is candidate personal votes / all valid votes for that candidate's party in the constituency. Denominators are independently summed from the pinned final district-vote workbook, including collection votes, and parliamentary parties are cross-checked against the existing official constituency totals. Five percent is tested with integer arithmetic (`personalVotes * 20 >= partyVotes`). Reaching that threshold is not an election/seat guarantee. See [Valmyndigheten's personal-vote rules](https://www.val.se/det-svenska-valsystemet/rostrakning-och-mandatfordelning/sa-utses-ledamoter).

The RD source has no municipal or physical-district personal-vote breakdown. The UI therefore shows the related **whole constituency**, never a guessed local allocation. A municipality's voters cannot be inferred from a candidate's constituency total.

## Public static endpoints

- `/api/elections/local/index.json`: county and municipality history, hierarchy and source metadata;
- `/api/elections/local/municipalities/1490.json`: example district results, comparability and SVG paths for Borås;
- `/api/elections/local/personal/19.json`: example constituency personal votes for Västra Götalands läns södra.

All 290 municipal and 29 personal-vote payloads are generated at build time. The browser loads only the selected detail, checks municipality identity and arithmetic against the already-verified index, cancels superseded requests and offers a retry on failure. Query parameters retain geography, party, metric, year and personal-vote constituency across reloads, history navigation and Swedish/English switching.

## Release validation

On 6 September 2026, `data:verify`, the full `check` pipeline (66 passing tests), and `build:pages` passed. All 290 exported municipal payloads were checked against the municipal index; all 29 exported personal-vote files retained the 1,457,836-vote total. Both exported language pages use the GitHub Pages base path.

Browser checks covered county/municipality/district selection, party and year changes, unavailable history, collection votes without turnout, exact-code GIS name fallbacks, personal-vote constituency identity, keyboard activation and language changes preserving the view. Deliberately blocked district requests produced the correct Swedish and English errors; retry restored the map while municipal figures remained available. Layouts were checked at 390, 768 and 1280 pixels without page-width overflow.
