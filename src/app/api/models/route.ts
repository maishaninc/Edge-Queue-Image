import { NextResponse } from 'next/server';
import { getModelConfigsAsync, getPublicModels } from '@/lib/models';
import { isModelDailyLimitReached } from '@/lib/model-usage';
import { isDatabaseConfigured } from '@/lib/env';

export async function GET() {
  const allModels = await getModelConfigsAsync();
  const available = await Promise.all(
    allModels.map(async (model) => {
      if (model.dailyLimit && isDatabaseConfigured()) {
        const reached = await isModelDailyLimitReached(model.id, model.dailyLimit);
        return reached ? null : model;
      }
      return model;
    }),
  );
  return NextResponse.json({ models: getPublicModels(available.filter(Boolean) as typeof allModels) });
}
