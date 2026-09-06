import preparation from "@/data/normalized/election-preparation-2026.json";
export const dynamic = "force-static";
export function GET() { return Response.json(preparation); }
