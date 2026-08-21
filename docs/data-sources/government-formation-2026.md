# Government-formation context for 2026

Registry: `data/context/government-formation-2026.json`

Top-level classification: **CONTEXT**

This registry explains what a modeled mandate result could mean under Swedish constitutional rules and records dated public positions from parties and leaders. It is deliberately separate from the polling forecast.

## Classification contract

- `CONTEXT` identifies constitutional rules or sourced explanatory background. It is not a probability.
- `DECLARED` identifies a dated public statement, platform position or reported commitment attributable to the named source. It describes what was said, not what will happen after the election.
- `MODEL` is reserved for Politicalverse probabilities, vote intervals and mandate simulations. Context records never acquire `MODEL` status merely because they appear next to a forecast.

Each claim stores publisher, source class, title, URL, publication/effective date when available and `checkedAt`. Party-primary and official-primary sources are preferred; public-service reporting is used for current cross-party statements when it is the clearest attributable record.

## Constitutional boundary

Under Swedish negative parliamentarism, a proposed prime minister is approved when fewer than 175 of 349 members vote no. The candidate does not need 175 affirmative votes. A model question asking whether a named set of parties reaches 175 seats therefore measures **own mandate majority**, not the probability that a prime minister is tolerated.

After the Riksdag has accepted the Speaker's proposal, the prime minister appoints the other ministers. Election arithmetic alone cannot determine the negotiated allocation of cabinet posts.

Primary constitutional reference: Sveriges riksdag, [Så bildas regeringen](https://www.riksdagen.se/sv/sa-fungerar-riksdagen/demokrati/sa-bildas-regeringen/).

## What Politicalverse may and may not infer

Politicalverse may combine the forecast with this registry to explain:

- whether a declared or arithmetical party grouping reaches 175 mandates in the central scenario;
- how often that exact grouping reaches 175 in the 10,000 model runs;
- which dated public conditions could make government formation easier or harder;
- why threshold outcomes change a side's negotiating strength.

Politicalverse does not publish probabilities for a named prime minister, a future minister, a particular cabinet post or a party-leader replacement in model v1. It also does not relabel a party's stated preference as a jointly agreed coalition. Those questions require separate evidence, resolution rules, historical training data and a calibrated person/government model that do not currently exist.

## Freshness and review

Government positions can change faster than constitutional rules. The UI must expose `checkedAt`, and stale claims must be rechecked against their recorded URLs before being presented as current. The automated six-hour poll refresh does **not** alter political context; mixing a successful poll download with unreviewed political statements would weaken provenance.

Changes to the registry require:

1. an attributable source and exact date;
2. neutral summary language that distinguishes a party's own statement from independent fact;
3. identical evidence rules for every party;
4. preservation of the prior Git version;
5. tests for registry shape, classifications, dates and URLs.

The current registry was checked on 2026-08-22. Its machine-readable entries—not a copied prose summary—are the canonical record for current leaders and declarations.
