# Scroll-aware header

## Current behavior

The previous implementation passed endpoint checks but the owner rejected its slow-motion behavior. A live 390 × 844 test reproduced the eight-pixel pause: scrollY 60 → 62 → 64 → 66 → 68 kept the header at zero, then 70 moved it only two pixels. Small reversals repeatedly changed between fixed and absolute positioning. Those mechanics have been removed.

The controller now retains only the last valid scroll position and a document anchor. It re-anchors when leaving either fully shown/hidden edge, consuming the first fractional movement immediately. Between the edges the anchor remains constant, including on a pause or reversal. CSS sticky positioning constrains the single surface to the interval from minus its height to zero. Reaching the visible edge does not change its display, position, renderer or anchor.

`.site-header-slot` is an empty, non-semantic spacer before the sticky positioning box. Its height equals the document anchor; the box's negative bottom margin cancels that height. Main content therefore retains its document coordinate. The spacer must be a sibling: putting the navigation inside a short spacer constrains sticky travel. A positive top margin on the sticky box itself also changes its permitted position box and is not interchangeable with this spacer.

The generic positioning box uses `display: contents` only after the entire navigation has left the viewport. Its child stays mounted, hidden and inert in ordinary flow, retaining the original header height. This removes the offscreen positioning renderer without changing rendering modes while anything is visible. There is no fixed positioning, counter-transform, opacity animation, custom status-area overlay or outer shadow. The semantic banner, controls and breadcrumb remain in the child.

Menu and keyboard access reveal the navigation immediately. While forced open, native `top: 0` keeps it visible. Escape returns focus without scrolling the document. Geometry is cached through ResizeObserver and viewport resize events; scroll processing does not measure layout. Out-of-bounds Safari rubber-band samples are ignored.

## Verification

Nine controller regressions cover fractional movement from both edges, pauses and two-pixel reversals, native edge stops, five full slow cycles, 2,000 mixed movements against an independent distance accumulator, rubber-band bounds, forced reveal, page top and resized header bounds.

Local browser observations at 390 × 844: downward ten-pixel steps moved the surface from 0 to −110 one-for-one; upward five-pixel steps moved it from −106 to −1 and then clamped at zero. Further two-pixel down/up movements produced 0, −2, −4, −6, −8, −10, −8, −6, −4, −2, 0 without a display/position change. Main stayed at documentY 111 throughout. The 1280-pixel layout similarly retained main at documentY 171. Opening the mobile menu at scrollY 250 and scrolling to 350 retained header top zero.

Browser QA must also cover menu dismissal, keyboard traversal, SV/EN, light/dark, reduced motion, viewport changes, deep restored positions and short pages. Record actual iPhone Safari and installed Home Screen app acceptance separately. Browser geometry does not establish native status-area appearance or touch/compositor timing on the owner's phone.

## References

- [CSS Positioned Layout, sticky positioning](https://drafts.csswg.org/css-position-3/#sticky-pos): scrollport constraints and the margin position box.
- [WebKit safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/): viewport fit and device-safe controls.
- [WebKit status-area regression](https://bugs.webkit.org/show_bug.cgi?id=305546): native appearance is not equivalent to DOM geometry.

The prior renderer-lifetime workaround was informed by WebKit's edge-color sampling code. Retiring the fully offscreen wrapper retains that precaution, but is not proof that a particular iOS release will sample every intermediate frame as intended.
