# Project identity — 7 September 2026

The owner supplied `politicalverse-logo-paket.zip` through [Google Drive](https://drive.google.com/file/d/1WUwPxzNiEnZubTwLbADJAa6vl8VMAzeQ/view). Original ZIP: 76,598 bytes; SHA-256 `5b9b7760da5aaed9087b87fd702ffd965f57e4826d64b2722595d9ef5e872769`. The [supplied handoff](source-handoff-2026-09-07.md) describes the crown with its cut-out Nordic cross. Original SVG and PNG assets are copied unchanged into `public/brand/crown-2026/`.

- `SiteBrand` uses the rounded SVG with the existing live-text serif wordmark in the header and footer, including the global 404. The crown stays visible on every screen; the header hides only the written name at 360px and below to keep controls usable. Accessible home-link names remain complete and localized.
- Brand blue is `#0c3d59`, secondary blue `#092e43`, and the supplied crown is `#ffd145`. Light-theme blue surfaces/links follow the supplied palette. Dark-theme text contrast, party colors, data graphics and neutral focus indicators retain their existing behavior.
- Both language layouts inherit `brandMetadata`, including localized 1200×630 Open Graph/Twitter PNGs, SVG and 16/32/48px favicons, multi-resolution ICO, and the supplied 180px Apple icon. Sharing titles and descriptions inherit each page's resolved metadata rather than a fixed homepage title.
- `/manifest.webmanifest` and `/en/manifest.webmanifest` are static exports with localized descriptions/start pages, one stable application ID, the GitHub Pages scope, 192/512px standard icons and the separate 512px maskable original. This covers the website saved to a home screen; it does not introduce an offline data cache or a native App Store build.
- Original 1024px and SVG app icons remain available for future app packaging. All metadata and rendered images use base-path-aware, versioned asset URLs. Conventional `favicon.ico` and `apple-touch-icon.png` copies are also exported. The 404 includes icons explicitly because it bypasses normal layouts.

## Regenerating derived sharing assets

`scripts/build-brand-assets.mjs` composes the unchanged SVG with the site's Georgia Bold / Arial typography through Next's `ImageResponse`. It also wraps the supplied favicon PNG bytes in an ICO container. Generated images are committed, so production builds do not need system fonts. Font files are rendering inputs and are not redistributed.

On macOS:

```sh
node scripts/build-brand-assets.mjs --serif-font '/System/Library/Fonts/Supplemental/Georgia Bold.ttf' --sans-font '/System/Library/Fonts/Supplemental/Arial.ttf'
```

For future replacements, update the versioned asset directory, shared metadata, 404 icon links and both manifests together. Check exported HTML for every language/route, all image URLs under the Pages base path, mobile menus at 320/390px, light/dark mode, the footer, and both sharing PNGs. Social services and operating systems can retain an already-saved preview/icon until their own cache refreshes.
