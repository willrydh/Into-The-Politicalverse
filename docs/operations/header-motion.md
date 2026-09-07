# Scroll-aware header

The owner reported iOS Safari/PWA blinking after removal of both the custom status-area overlay and the header shadow. Those changes did not resolve the native issue. This implementation replaces the old timed visibility switch and the scroll controller.

## Rendering

- `.site-header` supplies sticky positioning and normal document height. It has no background, border or transform, and stays `visibility:hidden` with `pointer-events:none`.
- Its semantic `.site-header__surface` banner explicitly stays `visibility:visible`, accepts pointer input and paints the complete header, including top safe-area padding and the existing separator. An explicit transform at rest and `will-change:transform` prepare this frequently moving surface as its own layer. Only its transform is animated, for 240 ms with an ease-out curve. There are no changing visibility, display, opacity, filter, shadow or height values during scrolling.
- The visible descendant of a hidden host is intentional CSS inheritance, not a hidden accessible banner. Verify the banner and its controls in the accessibility tree. The host is a layout box; the child owns all painted content on a separate layer.
- When slid off-screen, the banner is `inert` and ignores pointer events. Capture-phase Tab reveals it immediately before native focus traversal. Keyboard focus and an open mobile menu keep it available. Reduced motion disables the transition.
- The existing full-screen viewport, Apple metadata, both language roots, the 404 and safe-area dimensions remain unchanged. There is no custom status overlay.

The basis is [web.dev's animation guidance](https://web.dev/articles/animations-guide) and the transform-only pattern in [Headroom.js](https://wicky.nillia.ms/headroom.js/). Both recommend moving a prepared transform layer instead of repeatedly changing paint/layout properties. [CSS visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/visibility) permits explicitly visible descendants of a hidden box; [inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) handles off-screen interactivity without changing its painted visibility.

WebKit's [fixed-container sampling](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/LocalFrameView.cpp) rejects a fixed/sticky box whose own layer has no visible content. [RenderLayer](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/rendering/RenderLayer.cpp) distinguishes that layer's visible content from its child layers. The moving banner is neither fixed nor sticky; its non-painting parent supplies positioning. This is the source-based reason for separating the host and surface: prevent the parent from becoming a cached solid status-area tint without switching the moving surface's visibility at the end of every animation. This is an inference from WebKit's implementation, not proof of rendering on a specific iPhone release.

## Scroll decisions

`lib/ui/scroll-header.ts` tracks the most recent peak when hidden and trough when visible. It reveals after 8 px of upward movement and hides after 24 px downward. Small reversals do not accumulate into false gestures. At the top, within the header's height, it stays visible. Positions outside document bounds are ignored so iOS rubber-band rebound cannot trigger the opposite direction.

`useScrollHeader` coalesces scroll events into one pending animation frame. It reads only `scrollY` in the scroll update, uses cached dimensions, and writes DOM attributes only when the target state changes. ResizeObserver plus viewport resize events refresh dimensions and rebase the gesture anchor without changing the target. It does not run a continuous JavaScript animation or read layout after a scroll-state write.

## Verification

The regression tests cover slow fractional scrolling, jitter, directional reversals, top/bottom bounce, pinned controls and resized viewport anchors. Browser checks must cover both languages/themes, visible banner semantics, mobile-menu pinning, Tab reveal without a page jump, safe-area spacing, reduced motion, and a full hide/reveal/hide cycle. Check intermediate frames as well as final positions: surface visibility must remain visible, only transform should animate, and the hidden bottom edge must be above the viewport.

Local browser verification on 7 September 2026 covered Swedish/English, light/dark, widths 320/390/844/1280 and simulated 47 px top/side safe areas. The header measured 158 px including the top inset, with zero body top padding. Repeated reads during entry and exit showed monotonic positions from -1 to 158 px and back, with `visibility:visible` throughout. Native accessibility snapshots removed the inert off-screen links and restored them on reveal. Tab restored the menu while preserving scrollY=486. Menu pinning, Escape focus, landscape width and reduced-motion `transition:none` passed. These are browser observations, not an iPhone frame-rate measurement.

Native acceptance is still an installed iPhone PWA and iOS Safari check. Responsive browser geometry and automated tests do not establish native frame pacing or status-bar appearance. Do not call that device issue resolved solely because the code was published.
