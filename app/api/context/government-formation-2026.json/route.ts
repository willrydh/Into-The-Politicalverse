import { governmentFormationContext } from "@/lib/forecast/government";

export const dynamic = "force-static";

export function GET() {
  return Response.json(governmentFormationContext);
}
