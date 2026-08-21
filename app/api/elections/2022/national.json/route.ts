import { riksdag2022 } from "@/lib/data/elections";

export const dynamic = "force-static";

export function GET() {
  return Response.json({ election: riksdag2022.election, result: riksdag2022.national, source: riksdag2022.source });
}
