import type { Metadata } from "next";
import { UniversalSearch } from "@/components/search/universal-search";
import type { Locale } from "@/lib/i18n/messages";

export const metadata: Metadata = { title: "Sök på hela Politicalverse" };
export default function SearchPage({ locale = "sv" }: { locale?: Locale } = {}) { return <div lang={locale}><UniversalSearch /></div>; }
