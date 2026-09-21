import { getMap2026, mapCodes2026 } from "@/lib/data/geography/map-2026-server";
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() { return mapCodes2026().map(code => ({code:`${code}.json`})); }
export async function GET(_request: Request, {params}: {params: Promise<{code:string}>}) {
  return Response.json(getMap2026((await params).code.replace(/\.json$/,"")));
}
