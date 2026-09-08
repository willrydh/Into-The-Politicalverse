# Scroll-aware header

The owner supplied [this Tuts+ CodePen](https://codepen.io/tutsplus/pen/KKJPZMb) on 8 September 2026 and requested its bottom-bar behavior adapted to the top of Politicalverse. This supersedes the previous distance-tracking implementation.

Downward movement selects the hidden state; upward movement selects the shown state. CSS handles the entire slide with `transform 0.3s ease` in both directions. Reversing during the slide retargets the existing transition from its current rendered position. JavaScript does not calculate the intermediate position or start animation timers.

The one positioning box stays sticky at top zero so it preserves its original layout space without a separately measured spacer. Only its transform changes between zero and minus 100 percent. The previous document anchor, negative margin, spacer, pinned positioning mode and offscreen display switching have been removed. The safe-area inset is part of the moving surface, with no permanent page-top overlay or outer shadow.

At page top the header is shown. Menu or keyboard focus keeps it available; hidden controls are inert and Tab restores them before traversal. Escape returns focus without scrolling. Reduced-motion preference disables the slide. Out-of-bounds rubber-band samples are ignored. ResizeObserver caches the document bounds, so ordinary scroll frames do not read layout.

## Verification

Controller regressions cover fractional direction changes, pauses, overscroll, page top, menu/keyboard pinning and deep-link initialization. Browser QA must include repeated slow down/up movement, reversals during the 300ms slide, menu/Escape/Tab, both languages and viewport sizes. Actual iPhone Safari and Home Screen status-bar rendering remains a separate acceptance surface; desktop browser geometry is not proof of native compositor appearance.

## Sources

- [Owner-supplied reference and source code](https://codepen.io/tutsplus/pen/KKJPZMb).
- [CSS transitions and interrupted reversals](https://drafts.csswg.org/css-transitions/#reversing).
- [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
