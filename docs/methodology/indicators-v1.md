# Politicalverse national indicators — v2.0.0

Classification: **DERIVED**. None of these measures is a poll or forecast. Inputs are final Valmyndigheten Riksdag results; percentages refer to valid votes and changes use percentage points.

## PV-01 National swing

Half the sum of the absolute national vote-share changes across the eight parliamentary parties and the combined Other bucket between 2018 and 2022.

`0.5 × Σ |share(2022, party) − share(2018, party)|`

This is aggregate electoral movement. It does not identify individual voter flows.

## PV-02 Electoral momentum

The party with the largest positive national vote-share change between the final 2018 and 2022 results. The displayed value is that change in percentage points.

The label describes historical change only; it does not imply current polling momentum.

## PV-03 Geographic breadth

For each party, count Sweden's comparable municipalities where its final Riksdag vote share increased between 2018 and 2022. The displayed party is the party that improved in the largest number of municipalities.

`breadth(party) = municipalities with swing > 0 / 290 comparable municipalities`

Municipalities are unweighted, so this describes territorial breadth rather than the number of voters represented by the change. Exact swing and comparability rules are documented in [`municipality-swing-v1.md`](municipality-swing-v1.md). It is not a claim about municipal council control or individual voter movement.

## PV-04 Turnout trend

Final national turnout in 2022 minus final national turnout in 2018, expressed in percentage points.

`turnout(2022) − turnout(2018)`

## Version history

- `1.0.0` — initial deterministic definitions over the checked-in 2018 and 2022 official results.
- `2.0.0` — PV-03 replaced the single-election plurality footprint with change-based, unweighted geographic breadth over all 290 comparable 2018–2022 municipalities. PV-01, PV-02 and PV-04 are unchanged.
