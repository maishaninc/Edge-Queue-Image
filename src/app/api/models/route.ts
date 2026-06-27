import { NextResponse } from "next/server";

import { getPublicSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const pub = await getPublicSettings();
  return NextResponse.json({
    models: pub.models.availableModels,
    defaultImageModel: pub.models.defaultImageModel,
    qualities: pub.models.qualities,
    sizes: pub.models.sizes,
  });
}
