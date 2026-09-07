# Scroll-aware header

The owner rejected the permanently hidden sticky parent introduced in PR #25 and supplied an iPhone screenshot showing a blue band above the menu. Prior responsive browser checks did not prove that implementation worked on iOS. This replaces that rendering approach, not just its timing or color.

## Behavior

- `.site-header-slot` stays at the start of the document and reserves the measured header height. It does not paint, stick, transform or use hidden visibility. Moving the header out of flow cannot move the page content.
- `.site-header` is one opaque surface containing the semantic banner and top safe-area padding. On first load it has ordinary relative positioning and scrolls away with the page.
- After 8 px of upward movement beyond the original header, the same surface becomes fixed at `top:0`, respecting landscape left/right safe areas. Only its transform animates into view, using the browser's Web Animations API for 180 ms. A partial reveal starts from its current painted position. There is no permanent `will-change` or transform at rest.
- After 24 px down from the latest trough, the header changes from fixed to absolute at the corresponding document coordinate. Any extra movement in a large scroll event is included. Native scrolling moves it out of view; there is no exit animation or delayed visibility transition running against the scroll gesture. Reversing during entry cancels that animation from its current painted position.
- Once the released surface is entirely above the viewport, it returns to its original document position and becomes hidden/inert. There is no fixed or sticky header at the viewport edge while reading. The box holding its original height stays unchanged. At the page top the original banner is visible again.
- An open menu or keyboard focus pins the banner. Capture-phase Tab reveals controls immediately before native focus traversal, preserving the current reading position. Opening/closing the menu does not tear down the scroll controller. Reduced motion disables the entry animation.
- The full-screen viewport, Apple metadata, both languages, 404, safe-area controls and footer remain unchanged. No custom status-area overlay or header shadow is added.

## Implementation and sources

`lib/ui/scroll-header.ts` uses peak/trough hysteresis and rejects out-of-bounds rubber-band samples. The hook coalesces scroll events into a pending animation frame, caches dimensions with ResizeObserver, and reads geometry only when moving between flow/floating/released positions. It does not integrate an animation frame by frame or repeatedly move the header with scroll-time style writes.

[WebKit's safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) supports a full viewport with selective padding for interactive controls. [web.dev's animation guide](https://web.dev/articles/animations-guide) and [Headroom.js](https://wicky.nillia.ms/headroom.js/) explain transform-based entry and directional scroll tolerance. [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) supplies the cancellable entry motion. No inference about WebKit's native status-color sampling is treated as proof that a phone rendering defect is resolved.

## Verification

Regression cases cover initial native flow, small reversals near the top, slow fractional movement, jitter, release after a downward gesture, top/bottom bounce, pinned controls, resizing, large batched scroll events, an interrupted entry and returning to the page top without a premature jump.

Browser acceptance includes the screenshot's 390 px width and 47 px simulated top inset; native downward movement; large wheel/scroll jumps; interrupted entry; unchanged document content position; mobile menu, Escape and Tab; both themes/languages; portrait/landscape; reduced motion; and navigation between routes. Inspect the visible surface throughout movement, not only its final hidden position.

On 7 September, browser checks passed at 320/390/844/1280 px, in both themes and languages. With a 47 px top inset, header and placeholder both measured 158 px and body top padding stayed zero. Header movement matched native scrolling by 51 px while the main content remained at documentY=158. A large downward event returned the header to relative positioning with no transform. Tab restored it at the unchanged scrollY=1435. Landscape safe edges were 47/797 within 844 px, the menu ended at 351 within a 390 px viewport, navigation closed the menu at the new page top, and reduced motion used no transform. No browser console errors were observed.

Actual iPhone Safari and installed-PWA status-bar appearance and frame pacing remain a separate acceptance check. Do not call that issue resolved from viewport emulation, unit tests or publication alone.
