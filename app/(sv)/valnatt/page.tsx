import { pageMetadata } from "@/lib/page-metadata";
import { localizeNode } from "@/lib/i18n/react";
import type { Locale } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { ElectionNight } from "@/components/live/election-night";
import { validatePublicFeed } from "@/lib/live/public-feed";
import initial from "@/data/live/election-2026.json";
import preparation from "@/data/normalized/election-preparation-2026.json";
import { getSvtValu } from "@/lib/data/svt-valu";
export const metadata: Metadata = { ...pageMetadata("valnatt", "sv"), title: "Valnatten 2026", description: "SVT:s Valu och officiell rösträkning från Valmyndigheten, med tydliga källor och separata undersöknings- och valresultat." };
export default function ElectionNightPage({ locale = "sv" }: { locale?: Locale } = {}) {
  return localizeNode(<ElectionNight initialFeed={validatePublicFeed(initial)} valu={getSvtValu()} preparation={{ eligibleVoters: preparation.national.total, districts: preparation.districts.length, comparableDistricts: preparation.districts.filter(d => d.comparableTo2022).length, registeredParties: preparation.registeredRiksdagParties.length }} />, locale);
}
