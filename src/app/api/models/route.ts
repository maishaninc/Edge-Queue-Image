import { NextResponse } from 'next/server';
import { getModelConfigsAsync, getPublicModels } from '@/lib/models';

export async function GET() {
  return NextResponse.json({ models: getPublicModels(await getModelConfigsAsync()) });
}
