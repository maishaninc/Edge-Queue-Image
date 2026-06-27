import { NextResponse } from "next/server";

import { getPublicSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pub = await getPublicSettings();
  return new NextResponse(pub.adSense.adsTxt || "", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
