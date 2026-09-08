import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { CandidateProfile } from "@/components/candidates/person-profile";
import type { Locale } from "@/lib/i18n/messages";
export const metadata: Metadata = { ...pageMetadata("people", "sv"), title: "Kandidatprofiler · Personröster genom valen" };
export default function PeoplePage({locale="sv"}: {locale?:Locale}={}) {return <div lang={locale}><CandidateProfile/></div>;}
