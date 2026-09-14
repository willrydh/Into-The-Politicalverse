# Official results homepage, 14 September 2026

The owner requested counted 2026 votes as the primary homepage content after election night. Both language roots now use `HomeResults` and the existing validated, monotonic shared live-feed store. The crown, header, themes and inward-facing mandate layout are preserved. No collection, model, frozen-reference or candidate-history calculation changes.

## Source selection

`headlineResult` selects an available OFFICIAL national result for the feed’s election. While the final count begins again district by district, the homepage retains the preliminary national picture. It switches to final-count when all of that phase’s districts are reported, or if there is no preliminary snapshot. Never add votes from these separate counts. Election-night tabs continue to expose each phase independently, including the partial final count.

The result is labelled established only when it is final-count, all districts are reported, valid votes exist, the official protocol is published and the reported seat allocation totals 349. Complete district coverage alone is insufficient. Preliminary and ongoing final-count labels explicitly say that figures can change. Source errors retain the last verified figures with a delay warning; no forecast is substituted.

All vote counts, vote shares, turnout and individual mandates come from the selected official snapshot. District percentage divides reported districts by all districts and is explicitly not a percentage of votes counted. Turnout uses the electorate of counted districts. The party table uses valid votes as its denominator and separately reports invalid votes. Bloc totals sum only published mandates once the full national allocation totals 349; unavailable seats remain a dash and other parties never get assigned to either bloc. `LiveResultTable` is shared with election night.

## Presentation and updates

The homepage uses the existing 60-second browser refresh. Source revision and counting stage identify its hero and party table. It displays both the source update time and collection check time in Swedish time. Sorting uses raw numbers; mobile keeps accessible official party logos and every numerical column. Metadata and the universal-search page entry describe counted results. Historical charts remain explicitly labelled 2002–2022.

The V2 model remains on the forecast and election-night pages; the simulator still starts from its exact constituency inputs. The original frozen forecast remains the comparison reference. The homepage links to both the model and official-result/reference comparison.

According to [Valmyndigheten’s 10 September explanation](https://www.val.se/servicelankar/servicelankar/pressrum/nyheter--pressmeddelanden/nyheter-nya/2026-09-10-sa-har-raknas-rosterna-i-valen), final counting starts 14 September; the collection count includes late advance and overseas votes from 16 September. The Riksdag result is expected to be established about a week after election day. These are authority expectations, not a promise of completion or a timer that changes the result’s status.

## Verification

`tests/headline-result.test.ts` covers source selection, partial-to-complete recount transitions, protocol/seat requirements, source failure retention, missing versus zero mandates, parties outside the blocs and rejection of rehearsal/non-national data. The reviewed production fixture is from `live-data` commit `7801229fb2c7e24facbc18b9c66b7154594bfbde`, with complete official provenance. Its mutations are isolated test cases, never published observations. Run `npm run check` and `npm run data:verify`; visually check both languages and narrow/desktop views. After deployment compare the homepage revision, counts and mandates with the same stage on election night.

Local release verification: all 206 tests, typechecks, lint, static build and the complete data verification passed. Browser checks covered Swedish and English, 320/390-pixel mobile and 1280-pixel desktop, both themes, raw-value sorting and consistent source revisions. These are browser viewport checks, not a physical iPhone test.
