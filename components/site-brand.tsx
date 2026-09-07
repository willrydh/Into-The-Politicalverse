"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "./localize";
import { BRAND_NAME, brandAsset } from "@/lib/brand";

export function SiteBrand() {
  const locale = useLocale();
  return <Link className="wordmark" href={locale === "en" ? "/en/" : "/"} aria-label={`${BRAND_NAME}, ${locale === "sv" ? "startsida" : "home"}`}>
    <Image className="wordmark__mark" src={brandAsset("politicalverse-logo.svg")} alt="" aria-hidden="true" width={42} height={42} />
    <span className="wordmark__text"><small>Into the</small><strong>Politicalverse</strong></span>
  </Link>;
}
