import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { UniversalSearch } from "@/components/search/universal-search";
import type { Locale } from "@/lib/i18n/messages";

export const metadata: Metadata = { ...pageMetadata("search", "sv"), title: "Sök på hela Politicalverse" };
export default function SearchPage({ locale = "sv" }: { locale?: Locale } = {}) { return <div lang={locale}><UniversalSearch /></div>; }
