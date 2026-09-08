import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { CandidateRankings } from "@/components/candidates/rankings";
import type { Locale } from "@/lib/i18n/messages";
export const metadata: Metadata = { ...pageMetadata("rankings", "sv"), title: "Politikernas topplistor · Personröster" };
export default function RankingsPage({locale="sv"}: {locale?:Locale}={}) {return <div lang={locale}><CandidateRankings/></div>;}
