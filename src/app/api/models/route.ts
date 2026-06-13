import { NextResponse } from 'next/server';
import { getModelConfigs, getPublicModels } from '@/lib/models';

export async function GET() {
  return NextResponse.json({ models: getPublicModels(getModelConfigs()) });
}
