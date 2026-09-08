# Scroll-aware header

The owner supplied [this Tuts+ CodePen](https://codepen.io/tutsplus/pen/KKJPZMb) on 8 September 2026 and requested its bottom-bar behavior adapted to the top of Politicalverse. This supersedes the previous distance-tracking implementation.

Downward movement selects the hidden state; upward movement selects the shown state. CSS handles the entire slide with `transform 0.3s ease` in both directions. Reversing during the slide retargets the existing transition from its current rendered position. JavaScript does not calculate the intermediate position or start animation timers.

Desktop uses a sticky wrapper with a negative top equal to the measured branding/utility row height. That row scrolls away naturally before navigation and the location trail stick; upward scrolling returns only that compact area. The utility controls are hidden and inert while compact. The full header returns naturally at page top.

Mobile (≤980px) instead sticks the original logo/language/theme/Menu toolbar at top zero. The breadcrumb is its sibling in normal document flow, so it stays near the beginning of the page and never returns as a floating navigation strip. The wrapper uses `display: contents` at this breakpoint; only the toolbar is positioned and transformed. This is a fixed responsive layout, not a display change during scrolling. One Menu button serves both page top and upward reveal, and its dropdown anchors directly below the toolbar. Safe-area padding stays on that moving toolbar. Both responsive layouts retain their normal document space, with no spacer, margin compensation, permanent top overlay or outer shadow.

On desktop, the header remains shown within the branding row’s natural scroll distance. Mobile responds to scroll direction from the first movement. Menu or keyboard focus keeps it available; hidden controls are inert and Tab restores the available navigation before traversal. Escape returns focus without scrolling. Reduced-motion preference disables the slide. Out-of-bounds rubber-band samples are ignored. ResizeObserver caches the document bounds, so ordinary scroll frames do not read layout.

## Verification

The later owner correction supersedes the compact mobile breadcrumb/Menu strip: mobile must return the logo toolbar. Desktop retains the compact navigation/location behavior.

Controller regressions cover fractional direction changes, pauses, overscroll, page top, the natural branding-scroll interval, menu/keyboard pinning and deep-link initialization. Browser QA must include repeated slow down/up movement, reversals during the 300ms slide, menu/Escape/Tab, both languages and viewport sizes. Actual iPhone Safari and Home Screen status-bar rendering remains a separate acceptance surface; desktop browser geometry is not proof of native compositor appearance.

The earlier 8 September compact-header check covered desktop at 1280px and mobile layouts at 390px and 320px, including English breadcrumb wrapping, full top restoration and compact menu opening/closing. Repeated 2px wheel changes at 80ms intervals retargeted the same transition while the main content's document coordinate remained constant. Native pointer menu opening/closing preserved scroll position. These are browser checks, not native iPhone verification.

The subsequent mobile-toolbar verification covered 320px/390px mobile and 1280px desktop in both languages. Mobile upward reveal exposed the original toolbar and kept the breadcrumb outside the viewport. Repeated 2px direction changes at 80ms intervals retained a constant main-content document coordinate and intermediate transforms on the same toolbar. Native pointer open/Escape preserved scroll position, and Tab revealed hidden navigation. Desktop still returned navigation plus breadcrumbs and restored branding at page top.

## Sources

- [Owner-supplied reference and source code](https://codepen.io/tutsplus/pen/KKJPZMb).
- [CSS transitions and interrupted reversals](https://drafts.csswg.org/css-transitions/#reversing).
- [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
