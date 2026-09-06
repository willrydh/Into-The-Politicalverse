import { getPersonalConstituency, getLocalElectionIndex } from "@/lib/data/geography/local-server";
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() { return getLocalElectionIndex().national.constituencies!.map(code => ({ code: `${code}.json` })); }
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) { return Response.json(getPersonalConstituency((await params).code.replace(/\.json$/, ""))); }
