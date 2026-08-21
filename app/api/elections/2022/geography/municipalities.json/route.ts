import { riksdag2022 } from "@/lib/data/elections";

export const dynamic = "force-static";

export function GET() {
  return Response.json({ election: riksdag2022.election, level: "municipality", areas: riksdag2022.municipalities, source: riksdag2022.source });
}
