import { electionForecast } from "@/lib/forecast/data";

export const dynamic = "force-static";

export function GET() {
  return Response.json({ ...electionForecast, publication: {
    role: "frozen-pre-election-archive",
    currentForecastUrl: "https://raw.githubusercontent.com/willrydh/Into-The-Politicalverse/live-data/election-2026.json",
    currentForecastField: "nowcast.estimate",
    archivePage: "https://politicalverse.se/forecasts/#fore-valet",
  } });
}
