import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

// One-off export: commit the PNG/ICO outputs; CI needs no system fonts.
// Fonts are local rendering inputs, never distributed as web-font files.
const { values } = parseArgs({ options: { "serif-font": { type: "string" }, "sans-font": { type: "string" } } });
if (!values["serif-font"] || !values["sans-font"]) throw new Error("Supply --serif-font and --sans-font paths (Georgia Bold and Arial from the site's font stack).");
const directory = new URL("../public/brand/crown-2026/", import.meta.url);
const logo = await readFile(new URL("politicalverse-logo.svg", directory));
const fonts = [
  { name: "BrandSerif", data: await readFile(values["serif-font"]), weight: 700, style: "normal" },
  { name: "BrandSans", data: await readFile(values["sans-font"]), weight: 400, style: "normal" },
];

for (const [locale, tagline] of Object.entries({ sv: "Svensk valdata. Öppen analys.", en: "Swedish election data. Open analysis." })) {
  const image = new ImageResponse(h("div", { style: { display: "flex", width: "100%", height: "100%", alignItems: "center", background: "#0c3d59", color: "#ffffff", padding: "80px", gap: "48px", fontFamily: "BrandSans" } },
    h("img", { src: `data:image/svg+xml;base64,${logo.toString("base64")}`, width: 240, height: 240, alt: "" }),
    h("div", { style: { display: "flex", flexDirection: "column" } },
      h("div", { style: { fontSize: 22, letterSpacing: "4px" } }, "INTO THE"),
      h("div", { style: { fontFamily: "BrandSerif", fontWeight: 700, fontSize: 78, lineHeight: 1.15, marginTop: 10 } }, "Politicalverse"),
      h("div", { style: { fontSize: 26, marginTop: 28, color: "#dce9f0" } }, tagline),
    ),
  ), { width: 1200, height: 630, fonts });
  await writeFile(new URL(`opengraph-${locale}.png`, directory), Buffer.from(await image.arrayBuffer()));
}

// Preserve the supplied PNG bytes inside a multi-resolution ICO container.
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => readFile(new URL(`favicon-${size}.png`, directory))));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
const favicon = Buffer.concat([header, ...images]);
await writeFile(new URL("favicon.ico", directory), favicon);
await writeFile(new URL("../../favicon.ico", directory), favicon);
await writeFile(new URL("../../apple-touch-icon.png", directory), await readFile(new URL("politicalverse-app-icon-180.png", directory)));
console.log("Exported Swedish/English sharing images and the multi-resolution favicon.");
