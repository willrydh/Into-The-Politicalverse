import Privacy from "@/app/(sv)/privacy/page";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Home from "@/app/(sv)/page";
import Forecasts from "@/app/(sv)/forecasts/page";
import Charts from "@/app/(sv)/charts/page";
import Parties from "@/app/(sv)/parties/page";
import Maps from "@/app/(sv)/maps/page";
import Elections from "@/app/(sv)/elections/page";
import Indicators from "@/app/(sv)/indicators/page";
import Simulator from "@/app/(sv)/simulator/page";
import ElectionNight from "@/app/(sv)/valnatt/page";
import Search from "@/app/(sv)/search/page";
import Sources from "@/app/(sv)/sources/page";
import Press from "@/app/(sv)/press/page";

import Rankings from "@/app/(sv)/rankings/page";
import People from "@/app/(sv)/people/page";

const pages = { privacy: Privacy, "": Home, forecasts: Forecasts, charts: Charts, parties: Parties, maps: Maps, elections: Elections, indicators: Indicators, simulator: Simulator, overview: Home, valnatt: ElectionNight, sources: Sources, search: Search, rankings: Rankings, people: People, press: Press };
const titles: Record<string, string> = { privacy: "Privacy and statistics", "": "Swedish election forecast 2026", forecasts: "Forecast 2026", charts: "Charts", parties: "Parties", maps: "Maps", elections: "Elections", indicators: "Indicators", simulator: "Election simulator", overview: "Overview", valnatt: "Election night 2026", sources: "Data sources", search: "Search Politicalverse", rankings: "Candidate leaderboards", people: "Candidate histories", press: "Press and information" };
export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(pages).map(path => ({ path: path ? [path] : [] })); }
export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const path = (await params).path?.join("/") ?? "";
  return { ...pageMetadata(path, "en"), title: titles[path] ?? "Page not found" };
}
export default async function EnglishPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path?.join("/") ?? "";
  if (!(path in pages)) notFound();
  const Page = pages[path as keyof typeof pages];
  return <Page locale="en" />;
}
