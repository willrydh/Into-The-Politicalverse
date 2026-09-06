import { getLocalElectionIndex } from "@/lib/data/geography/local-server";
export const dynamic = "force-static";
export function GET() { return Response.json(getLocalElectionIndex()); }
