# Project identity — 7 September 2026

The owner supplied `politicalverse-logo-paket.zip` through [Google Drive](https://drive.google.com/file/d/1WUwPxzNiEnZubTwLbADJAa6vl8VMAzeQ/view). Original ZIP: 76,598 bytes; SHA-256 `5b9b7760da5aaed9087b87fd702ffd965f57e4826d64b2722595d9ef5e872769`. The [supplied handoff](source-handoff-2026-09-07.md) describes the crown with its cut-out Nordic cross. Original SVG and PNG assets are copied unchanged into `public/brand/crown-2026/`.

- `SiteBrand` uses the rounded SVG with the existing live-text serif wordmark in the header and footer, including the global 404. The crown stays visible on every screen; the header hides only the written name at 360px and below to keep controls usable. Accessible home-link names remain complete and localized.
- Brand blue is `#0c3d59`, secondary blue `#092e43`, and the supplied crown is `#ffd145`. Light-theme blue surfaces/links follow the supplied palette. Dark-theme text contrast, party colors, data graphics and neutral focus indicators retain their existing behavior.
- Both language layouts inherit `brandMetadata`. The primary Open Graph image is the supplied square 1024px crown, with localized alt text; the localized 1200×630 images are reserved for Twitter's large-image cards. SVG and 16/32/48px favicons, multi-resolution ICO, and the supplied 180px Apple icon are included. Sharing titles and descriptions inherit each page's resolved metadata rather than a fixed homepage title.
- `/manifest.webmanifest` and `/en/manifest.webmanifest` are static exports with localized descriptions/start pages, one stable application ID, the GitHub Pages scope, 192/512px standard icons and the separate 512px maskable original. This covers the website saved to a home screen; it does not introduce an offline data cache or a native App Store build.
- Original 1024px and SVG app icons remain available for future app packaging. All metadata and rendered images use base-path-aware, versioned asset URLs. Conventional `favicon.ico` and `apple-touch-icon.png` copies are also exported. The 404 includes icons explicitly because it bypasses normal layouts.

## PWA display

Both language roots and the exported 404 share `siteViewport`: `width=device-width, initial-scale=1, viewport-fit=cover`, without disabling pinch zoom. Shared metadata includes both mobile-web-app-capable forms and `apple-mobile-web-app-status-bar-style=black-translucent`. Apple's [status-bar documentation](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html) distinguishes this full-screen content mode from `default`, which places content below the status bar. WebKit documents [viewport-fit and safe-area insets](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).

The header includes `env(safe-area-inset-top)` in its measured height. Do not add permanent body top padding or another fixed opaque strip. Horizontal safe areas protect landscape content, and the footer/menu accommodate the home indicator. The 404's server wrapper supplies viewport metadata while its client document still resolves the language from the URL.

On 7 September the owner reported that the initial metadata/viewport change left a white status area in the installed PWA and iOS Safari. Moving the semantic banner into a generic sticky surface and hiding that surface after its slide improved the status area, but the owner continued to report a translucent strip and blinking. Removing the custom fixed overlay and then the header shadow did not resolve the device issue. Those reports supersede earlier claims of completion.

The next attempt used a permanently hidden sticky parent with an explicitly visible transformed child. The owner rejected that implementation and supplied an iPhone screenshot with a blue band between the system status field and the header. Its desktop/browser checks did not establish native correctness.

The root-scroll translation introduced afterward also failed device acceptance: the owner’s 8 September screenshot showed page content behind the clock while the revealed navigation began below it, in both Safari and the installed Home Screen app. The owner subsequently confirmed PR #28 functioned, while rejecting its motion quality. The current revision preserves that status-area integration and removes the separate timed entrance: the same opaque navigation surface follows document scrolling in both directions, including partial reversals, then pins only once fully shown. During movement its generic positioning wrapper is `display: contents`; its renderer disappears, preventing WebKit from retaining it as the previous fixed container. The placeholder preserves document height without painting or sticking. There is no per-frame root-scroll translation, duplicated navigation or persistent status overlay. Keyboard access and mobile menu pinning remain available, with no decorative motion to disable.

The custom `body::before` tint/blur, outer header shadow and hidden-parent trick remain removed. See [header motion](../operations/header-motion.md) for behavior, sources and verification limits.

Verification must distinguish responsive browser checks from an installed iPhone PWA. Check both iOS Safari and the installed app: downward/upward/downward scrolling, the home page behind the status field, menu reveal below the system icons, pale and dark sections, landscape, the menu's last link, the footer above the home indicator, and Tab access from a hidden header. Browser tests with simulated top/side/bottom insets verify spacing and scroll behavior; they cannot confirm native iOS status-icon rendering. Do not call this device issue resolved until the owner confirms the native result.

## Regenerating derived sharing assets

Safari's compact sharing thumbnail cropped the original wide Open Graph card around its center, showing the written name and losing the crown at the left. Home-screen icons already contained the crown; changing only `apple-touch-icon` would not address that preview. [Apple's rich-link guidance](https://developer.apple.com/videos/play/tech-talks/205/) explains that a supplied Open Graph image can take the icon's place. Keep the primary Open Graph image square and free of wordmark text. Do not add the wide card as an alternative Open Graph image: thumbnail consumers choose images and crops independently. The screenshot received on 7 September is the acceptance case; a desktop metadata check alone does not prove the iPhone share sheet.

`scripts/build-brand-assets.mjs` composes the unchanged SVG with the site's Georgia Bold / Arial typography through Next's `ImageResponse`. It also wraps the supplied favicon PNG bytes in an ICO container. Generated images are committed, so production builds do not need system fonts. Font files are rendering inputs and are not redistributed.

On macOS:

```sh
node scripts/build-brand-assets.mjs --serif-font '/System/Library/Fonts/Supplemental/Georgia Bold.ttf' --sans-font '/System/Library/Fonts/Supplemental/Arial.ttf'
```

For future replacements, update the versioned asset directory, shared metadata, 404 icon links and both manifests together. Check exported HTML for every language/route, all image URLs under the Pages base path, mobile menus at 320/390px, light/dark mode, the footer, and both sharing PNGs. Social services and operating systems can retain an already-saved preview/icon until their own cache refreshes.

## Candidate sharing cards

Candidate-specific profile links use their own 1200 × 630 PNG with the supplied crown, official personal votes and derived election-to-election change. This explicit profile exception keeps generic share-sheet/app icons unchanged. The card is rebuilt from versioned public history, including accepted future election results. See [candidate sharing](../operations/candidate-sharing.md).
