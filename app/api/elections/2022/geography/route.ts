import { type NextRequest, NextResponse } from "next/server";
import { riksdag2022 } from "@/lib/data/elections";

export function GET(request: NextRequest) {
  const level = request.nextUrl.searchParams.get("level") ?? "constituency";

  if (level !== "constituency" && level !== "municipality") {
    return NextResponse.json({ error: "level must be constituency or municipality" }, { status: 400 });
  }

  const areas = level === "constituency" ? riksdag2022.constituencies : riksdag2022.municipalities;
  return NextResponse.json(
    { election: riksdag2022.election, level, areas, source: riksdag2022.source },
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
