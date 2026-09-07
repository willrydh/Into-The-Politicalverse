# Scroll-aware header

The owner confirmed PR #28 functioned in the ongoing iOS acceptance conversation but rejected its motion quality. This revision preserves that renderer lifecycle and makes entry and exit follow the same native document movement. The preceding PR #27 failed on the device despite passing desktop geometry checks; viewport top zero alone does not prove integration with the native status area.

## Behavior

- `.site-header-slot` reserves the measured header height at the document start. It does not paint, stick, transform or become hidden.
- `.site-header` is the single opaque navigation surface, including the semantic banner and top safe-area padding. It begins in ordinary relative document flow and scrolls away naturally.
- `.site-header-positioner` is a generic wrapper with `display: contents` in normal flow: it has no layout/rendering box and no accessibility role. The semantic navigation stays in its child.
- After 8 px upward beyond the original header, tracking starts with the surface immediately above the viewport. It enters using one absolute document coordinate, moving one pixel per pixel of subsequent upward scroll. A pause stops it; a partial reversal uses the same coordinate, without restarting or snapping.
- Once fully shown, the positioner becomes a fixed box at viewport top, inside the horizontal safe areas. iOS can recognize the visible navigation when extending its background behind the system status field. There is no entrance timer, transform, shadow or `will-change`.
- After 8 px downward, the positioner returns to `display: contents`. This removes its renderer immediately. Its same child starts at the painted viewport edge, using an absolute document coordinate, and leaves with subsequent native scrolling. Past/batched deltas are not replayed as a catch-up jump. Entry and exit therefore have the same relationship to the gesture. There is no timed exit, visibility fade, duplicate navigation or permanent status-area overlay.
- Once the surface is entirely offscreen, it returns to its original relative flow, hidden and inert. At the page top it is visible again. The slot keeps page content from jumping.
- Open menus and keyboard access reveal/pin the positioner immediately. Capture-phase Tab reveals controls before native focus traversal. Navigation focus clears the content anchor exclusion margin so the browser does not scroll visible controls below the header. Reduced motion uses the same native scroll behavior; there is no decorative header animation to disable.
- Full-screen viewport metadata, both language roots, the 404, safe-area control spacing, footer and mobile menu remain shared and unchanged.

## Why the renderer lifecycle matters

[WebKit's LocalFrameView](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/LocalFrameView.cpp) selects fixed/sticky renderers for native edge-color sampling. An absolute element counter-translated to viewport top is not such a candidate, regardless of its `getBoundingClientRect()` value. The owner's image demonstrates why that prior browser-only assertion was insufficient.

[WebKit's Page::updateFixedContainerEdges](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Page.cpp) may preserve the previous container's color when a new candidate is absent. It checks whether the old element still has a renderer before retaining it. Simply switching that element from fixed to absolute leaves a renderer; `display: contents` removes the positioning wrapper's box while preserving its children. This is the implementation rationale, not proof of the exact WebKit build or native rendering on the owner's phone. The related [Safari status-area regression](https://bugs.webkit.org/show_bug.cgi?id=305546) documents differences between page positioning and native status appearance.

The wrapper must stay generic. Do not put the semantic banner or controls on the box removed by `display: contents`, and do not restore the rejected permanently hidden-parent/visible-child trick. The semantic `<header>` and all interactive DOM nodes stay mounted in the same `.site-header` surface through every transition.

The pure direction controller in `lib/ui/scroll-header.ts` has flow, tracking and floating phases. It retains peak/trough hysteresis and rejection of out-of-bounds rubber-band samples. Exact-edge guards prevent repeated same-position events from cancelling a new reveal or re-pinning a release. `use-scroll-header.ts` coalesces scroll events in one animation frame and caches geometry with ResizeObserver. During tracking, the document coordinate is unchanged and the browser owns movement; no layout reads or CSS position writes run per scroll frame. Root-scroll timelines and their per-frame JavaScript fallback remain removed.

[WebKit's safe-area guide](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [web.dev's animation guide](https://web.dev/articles/animations-guide) and [CSS display](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display) describe the underlying viewport, motion and box behavior.

## Verification

Fourteen direction/coordinate regressions cover initial flow, fractional movement, jitter, direct movement and pauses, partial reversals, exact-edge duplicate samples, five complete cycles, top/bottom bounce, pinned controls, resizing, large batched events and returning to the page top.

Browser acceptance must inspect both the positioning wrapper and visible surface. During reveal and release, the wrapper must have `display: contents` and zero client rectangles. A partial reveal must stop with the page and retain its document coordinate across reversals. A completed reveal must produce a fixed wrapper with the surface at top zero. Main content must keep its document coordinate and only one navigation surface may exist. Verify at least five cycles without returning to the top, open/close/Escape, keyboard access from an off-screen header, both languages/themes, reduced motion and safe-area/viewport changes.

On 8 September the local browser check passed five repeated dark/SV cycles at 390×844 with a 59 px top inset and a constant 170 px slot. During entry a 51 px upward movement brought the surface from top -170 to -119; pausing preserved -119, and reversing down 34 px moved it to -153 without changing its document coordinate. Exit began at top zero, then moved to -51 for a 51 px scroll and back to -25 for a 26 px reversal. The wrapper had `display: contents` throughout partial movement and became fixed only when fully shown. EN/light/reduced-motion checks with zero top inset kept main at documentY=111, with one header surface. Mobile menu open/close and Escape passed. Tab restored the hidden header; reverse Tab into its Menu button retained scrollY=310. These are browser observations; record native iPhone acceptance separately.

Do not declare the status-area issue resolved from browser emulation, unit tests, or deployment alone. Both Safari and the installed Home Screen app require confirmation on the owner's actual iPhone, including another upward/downward cycle and the area behind the clock throughout motion.
