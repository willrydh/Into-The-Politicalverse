# Current election-night projection, 13 September 2026

The owner selected `pv-nowcast-2.0.0` as the common current national forecast. This is a presentation/input-source change, not a refit of the estimator, probability distribution or historical reference.

## Data flow

`live-data/election-2026.json` → validated shared browser store → `publicNowcast`/`publicProbability` → home, forecasts, election night, government combinations and default simulator. One request loop serves all mounted consumers; it survives client navigation with the last accepted generation, rejects source regressions and ignores late responses after unmount. The server render has no purportedly current model values until the browser establishes freshness. Each current view uses the same 15-minute collection freshness limit and failure gate.

Current coalition seats sum only the model rows. Only the two bloc probabilities actually emitted by V2 are displayed; other combinations have seat arithmetic without inferred probabilities. Integer percentage formatting and unresolved-draw denominators agree with the election-night panel. Historical indicators, candidate histories and official results retain their actual source scope and classification.

## Simulator

The pipeline exports `estimate.scenarioInput` only with a supported central seat calculation. It contains the exact 29 rounded constituency inputs already used by V2. It does not change that calculation. Client validation checks the official structure, party and total reconciliation within a maximum one vote per party per constituency rounding bound, OTHER threshold guards, and exact eight-party seat reproduction. Old feeds lacking the optional field still display their projection; the simulator waits for an upgraded collector.

The untouched simulator recalculates those exact inputs. Custom shares pin their starting generation and use its geographic weights in deterministic scenario model 1.1.0. Reset resumes live following. These scenarios are explicitly labelled and never written back to the public projection.

## Archive

`/forecasts/#fore-valet` contains the former forecast UI under a closed archive disclosure. The static `/api/forecasts/2026.json` remains backward compatible and adds an explicit `frozen-pre-election-archive` role plus the live feed URL and field. The frozen reference JSON, cutoff and checksums are unchanged. The official-result comparison continues to load that reference, never the current nowcast. Search entries distinguish historical questions from current model information.

## Verification

`tests/current-projection.test.ts` verifies same-generation totals, exact simulator reproduction, unavailable/mixed data, malformed optional scenario inputs, shared polling, monotonic updates, recovery and late-response isolation. Its gzip fixture preserves the reviewed production/model snapshot from 13 September 2026 at 20:14:36 UTC (revision 207); complete official and model provenance is inside the snapshot. It is a regression fixture, never a production feed.

Run `npm run check` and `npm run data:verify`. After merging, restart the bounded collector on the merged main code so `scenarioInput` is available before final live acceptance. Verify the model revision and eight party seats across home, forecasts, election night and the untouched simulator in both languages. Also verify an edited scenario remains pinned and resets correctly.
