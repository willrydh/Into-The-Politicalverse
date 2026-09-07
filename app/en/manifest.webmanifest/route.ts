import { brandManifest } from "@/lib/brand-metadata";

export const dynamic = "force-static";
export function GET() {
  return Response.json(brandManifest("en"), { headers: { "Content-Type": "application/manifest+json" } });
}
