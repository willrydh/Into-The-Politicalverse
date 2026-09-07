import reference from "@/data/normalized/election-forecast-reference-2026.json";
export const dynamic = "force-static";
export function GET() { return Response.json(reference); }
