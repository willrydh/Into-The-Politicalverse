# Shared public-page spacing

All public page types use the same 1280px maximum content width through `--page`. The outer gutter is 32px on desktop, 24px below the existing tablet breakpoint and 20px below 820px. Full-width hero backgrounds use `--page-inset` to align their text with the same container. Candidate, search and press pages no longer own separate 1320px/1160px widths.

`--panel-pad` sets a 24px desktop and 20px mobile inset for bordered content panels and cards. Keep compact chips, buttons, numeric table cell spacing and intentionally flush component shells separate from page insets. Tables retain their alignment, column layout and contained scrolling. Nested panels have one explicit inset per visible boundary; the expandable forecast archive must not acquire a second page gutter or a wider viewport-based child.

Visual checks cover home/overview, election night, forecasts including the expanded archive, charts, parties, both map generations, elections, rankings, populated candidate profiles, indicators, simulator, search, source catalogue, press and privacy, in Swedish and English. Use phone, tablet and desktop widths, plus narrow-phone overflow checks. Native iOS safe-area/header motion is separate from viewport emulation; this spacing change does not replace the header motion implementation.
