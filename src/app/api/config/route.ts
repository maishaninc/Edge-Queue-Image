import { NextResponse } from "next/server";

import { getPublicSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, non-secret runtime config consumed by the browser (login + workbench). */
export async function GET() {
  const pub = await getPublicSettings();
  return NextResponse.json(pub);
}
