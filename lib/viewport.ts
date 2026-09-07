import type { Viewport } from "next";

export const siteViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const pwaStatusBarStyle = "black-translucent" as const;
