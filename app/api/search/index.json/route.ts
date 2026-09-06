import { buildSearchIndex } from "@/lib/search/build";

export const dynamic = "force-static";
export function GET() { return Response.json(buildSearchIndex()); }
