import { getLocalDistrictPayload, getLocalElectionIndex } from "@/lib/data/geography/local-server";

export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() { return getLocalElectionIndex().municipalities.map(m => ({ code: `${m.code}.json` })); }
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  return Response.json(getLocalDistrictPayload((await params).code.replace(/\.json$/, "")));
}
