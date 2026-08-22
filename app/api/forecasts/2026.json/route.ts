import { electionForecast } from "@/lib/forecast/data";

export const dynamic = "force-static";

export function GET() {
  return Response.json(electionForecast);
}
