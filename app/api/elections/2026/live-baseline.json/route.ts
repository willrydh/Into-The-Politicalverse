import feed from "@/data/live/election-2026.json";
export const dynamic = "force-static";
export function GET() { return Response.json(feed); }
