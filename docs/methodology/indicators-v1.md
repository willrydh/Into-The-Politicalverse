# Politicalverse national indicators — v1.0.0

Classification: **DERIVED**. None of these measures is a poll or forecast. Inputs are final Valmyndigheten Riksdag results; percentages refer to valid votes and changes use percentage points.

## PV-01 National swing

Half the sum of the absolute national vote-share changes across the eight parliamentary parties and the combined Other bucket between 2018 and 2022.

`0.5 × Σ |share(2022, party) − share(2018, party)|`

This is aggregate electoral movement. It does not identify individual voter flows.

## PV-02 Electoral momentum

The party with the largest positive national vote-share change between the final 2018 and 2022 results. The displayed value is that change in percentage points.

The label describes historical change only; it does not imply current polling momentum.

## PV-03 Geographic breadth

The number of Sweden's 290 municipalities in which a party had the largest share of the final 2022 Riksdag vote. Ties, if introduced by future source data, require an explicit rule before a new methodology version.

This is not a claim about which party controls a municipal council and is not the change-based breadth definition planned for multi-election municipal data.

## PV-04 Turnout trend

Final national turnout in 2022 minus final national turnout in 2018, expressed in percentage points.

`turnout(2022) − turnout(2018)`

## Version history

- `1.0.0` — initial deterministic definitions over the checked-in 2018 and 2022 official results.
