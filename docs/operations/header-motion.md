# Scroll-aware header

The owner's 8 September iPhone screenshot shows page content behind the clock while the revealed menu begins below it. The owner confirmed this occurs in both Safari and the installed Home Screen app. PR #27's absolute root-scroll translation passed desktop geometry checks but failed this device acceptance case. Checking viewport top zero does not prove integration with the native status area.

## Behavior

- `.site-header-slot` reserves the measured header height at the document start. It does not paint, stick, transform or become hidden.
- `.site-header` is the single opaque navigation surface, including the semantic banner and top safe-area padding. It begins in ordinary relative document flow and scrolls away naturally.
- `.site-header-positioner` is a generic wrapper with `display: contents` in normal flow: it has no layout/rendering box and no accessibility role. The semantic navigation stays in its child.
- After 8 px upward beyond the original header, the positioner becomes a fixed box at viewport top, inside the horizontal safe areas. iOS can recognize the visible navigation when extending its background behind the system status field. A cancellable 180 ms WAAPI transform brings it into view from the currently painted position. There is no persistent transform, shadow or `will-change` at rest.
- After 24 px downward, the positioner returns to `display: contents`. This removes its renderer immediately. Its same child uses an absolute document coordinate and leaves with native scrolling. Large batched deltas and interrupted entry motion are included in that coordinate. There is no timed exit, visibility fade, duplicate navigation or permanent status-area overlay.
- Once the surface is entirely offscreen, it returns to its original relative flow, hidden and inert. At the page top it is visible again. The slot keeps page content from jumping.
- Open menus and keyboard access reveal/pin the positioner. Capture-phase Tab reveals controls before native focus traversal. Navigation focus clears the content anchor exclusion margin so the browser does not scroll visible controls below the header. Reduced motion skips entry animation.
- Full-screen viewport metadata, both language roots, the 404, safe-area control spacing, footer and mobile menu remain shared and unchanged.

## Why the renderer lifecycle matters

[WebKit's LocalFrameView](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/LocalFrameView.cpp) selects fixed/sticky renderers for native edge-color sampling. An absolute element counter-translated to viewport top is not such a candidate, regardless of its `getBoundingClientRect()` value. The owner's image demonstrates why that prior browser-only assertion was insufficient.

[WebKit's Page::updateFixedContainerEdges](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/Page.cpp) may preserve the previous container's color when a new candidate is absent. It checks whether the old element still has a renderer before retaining it. Simply switching that element from fixed to absolute leaves a renderer; `display: contents` removes the positioning wrapper's box while preserving its children. This is the implementation rationale, not proof of the exact WebKit build or native rendering on the owner's phone. The related [Safari status-area regression](https://bugs.webkit.org/show_bug.cgi?id=305546) documents differences between page positioning and native status appearance.

The wrapper must stay generic. Do not put the semantic banner or controls on the box removed by `display: contents`, and do not restore the rejected permanently hidden-parent/visible-child trick. The semantic `<header>` and all interactive DOM nodes stay mounted in the same `.site-header` surface through every transition.

The pure direction controller in `lib/ui/scroll-header.ts` retains peak/trough hysteresis and rejection of out-of-bounds rubber-band samples. `use-scroll-header.ts` coalesces scroll events in one animation frame, caches geometry with ResizeObserver and reads the surface only at direction changes. Root-scroll timelines and their per-frame JavaScript fallback have been removed.

[WebKit's safe-area guide](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [web.dev's animation guide](https://web.dev/articles/animations-guide), [Element.animate](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate) and [CSS display](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display) describe the underlying viewport, motion and box behavior.

## Verification

Existing direction/coordinate regressions cover initial flow, fractional movement, jitter, repeated reversals, release thresholds, top/bottom bounce, pinned controls, resizing, large batched events, interrupted entry and returning to the page top.

Browser acceptance must inspect both the positioning wrapper and visible surface. After each downward release, including while the navigation is still partially visible, the wrapper must have `display: contents` and zero client rectangles. Each upward reveal must produce a fixed wrapper with the surface at top zero. Main content must keep its document coordinate and only one navigation surface may exist. Verify at least five cycles without returning to the top, open/close/Escape, Tab from an off-screen header, both languages/themes, reduced motion and safe-area/viewport changes.

On 8 September the local browser check passed five repeated dark/SV cycles at 390×844 with a 59 px top inset: each downward pass had no positioning box, each reveal had top zero, and main stayed at documentY=170. During a partial release, the wrapper already had zero boxes while the surface moved from top -10 to -61 for a 51 px scroll. Menu pinning and Escape passed. EN/reduced-motion checks with zero top inset kept main at documentY=111 and preserved scrollY during keyboard reveal. These are browser observations; record native iPhone acceptance separately.

Do not declare the status-area issue resolved from browser emulation, unit tests, or deployment alone. Both Safari and the installed Home Screen app require confirmation on the owner's actual iPhone, including another upward/downward cycle and the area behind the clock throughout motion.
