import { NextResponse } from "next/server";
import { riksdag2022 } from "@/lib/data/elections";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    { election: riksdag2022.election, result: riksdag2022.national, source: riksdag2022.source },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
