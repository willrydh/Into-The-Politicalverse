# Scroll-aware header

The owner supplied [this Tuts+ CodePen](https://codepen.io/tutsplus/pen/KKJPZMb) on 8 September 2026 and requested its bottom-bar behavior adapted to the top of Politicalverse. This supersedes the previous distance-tracking implementation.

Downward movement selects the hidden state; upward movement selects the shown state. CSS handles the entire slide with `transform 0.3s ease` in both directions. Reversing during the slide retargets the existing transition from its current rendered position. JavaScript does not calculate the intermediate position or start animation timers.

The one positioning box has a negative sticky top equal to the measured branding/utility row height. That row scrolls away naturally before the box sticks; it stays in document flow, without a spacer or changing margins. Downward scrolling then translates the remaining navigation, location trail and safe-area inset above the viewport. Upward scrolling returns only that compact area. The full header returns naturally at page top. The utility controls are hidden and inert while compact, so they cannot appear under status icons or receive offscreen focus. On mobile, the existing full header remains at page top; a compact Menu disclosure beside the location trail provides navigation while reading. Only one Menu button is exposed at a time. There is no permanent page-top overlay or outer shadow.

Within the branding row’s scroll distance the header remains shown and scrolls naturally. Menu or keyboard focus keeps it available; hidden controls are inert and Tab restores the available navigation before traversal. Escape returns focus without scrolling. Reduced-motion preference disables the slide. Out-of-bounds rubber-band samples are ignored. ResizeObserver caches the document bounds, so ordinary scroll frames do not read layout.

## Verification

Controller regressions cover fractional direction changes, pauses, overscroll, page top, the natural branding-scroll interval, menu/keyboard pinning and deep-link initialization. Browser QA must include repeated slow down/up movement, reversals during the 300ms slide, menu/Escape/Tab, both languages and viewport sizes. Actual iPhone Safari and Home Screen status-bar rendering remains a separate acceptance surface; desktop browser geometry is not proof of native compositor appearance.

The 8 September compact-header check covered desktop at 1280px and mobile layouts at 390px and 320px, including English breadcrumb wrapping, full top restoration and compact menu opening/closing. Repeated 2px wheel changes at 80ms intervals retargeted the same transition while the main content's document coordinate remained constant. Native pointer menu opening/closing preserved scroll position. These are browser checks, not native iPhone verification.

## Sources

- [Owner-supplied reference and source code](https://codepen.io/tutsplus/pen/KKJPZMb).
- [CSS transitions and interrupted reversals](https://drafts.csswg.org/css-transitions/#reversing).
- [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
