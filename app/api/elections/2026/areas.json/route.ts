import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateAreaFeed } from "@/lib/live/public-area-feed";
export const dynamic = "force-static";
export function GET() { return Response.json(validateAreaFeed(JSON.parse(readFileSync(join(process.cwd(), "data/live/area-results-2026.json"), "utf8")))); }
