import { getRuntimeSettings } from './settings';

export type ImageModelConfig = {
  id: string;
  name: string;
  api: string;
  key: string;
};

export type PublicModel = {
  id: string;
  name: string;
  icon: ModelIcon;
};

export type ModelIcon = 'openai' | 'flux' | 'seedream' | 'google' | 'stable' | 'model';

function completeModelGroup(model?: string, key?: string, api?: string) {
  return Boolean(model?.trim() && key?.trim() && api?.trim());
}

export function parseModelConfigs(env: NodeJS.ProcessEnv = process.env): ImageModelConfig[] {
  const models: ImageModelConfig[] = [];

  if (completeModelGroup(env.MODEL, env.KEY, env.API)) {
    models.push({
      id: 'default',
      name: env.MODEL!.trim(),
      key: env.KEY!.trim(),
      api: env.API!.trim().replace(/\/+$/, ''),
    });
  }

  for (let index = 1; index <= 50; index += 1) {
    const model = env[`MODEL_${index}`];
    const key = env[`KEY_${index}`];
    const api = env[`API_${index}`];
    if (!model && !key && !api) {
      continue;
    }
    if (!completeModelGroup(model, key, api)) {
      continue;
    }
    models.push({
      id: String(index),
      name: model!.trim(),
      key: key!.trim(),
      api: api!.trim().replace(/\/+$/, ''),
    });
  }

  return models;
}

export function getModelConfigs() {
  return parseModelConfigs();
}

export async function getModelConfigsAsync() {
  return (await getRuntimeSettings()).models;
}

export function getPublicModels(models = getModelConfigs()): PublicModel[] {
  return models.map((model) => ({ id: model.id, name: model.name, icon: inferModelIcon(model.name) }));
}

export function resolveModel(modelId: string, models = getModelConfigs()) {
  return models.find((model) => model.id === modelId);
}

export async function resolveModelAsync(modelId: string) {
  const models = await getModelConfigsAsync();
  return models.find((model) => model.id === modelId);
}

export function inferModelIcon(name: string): ModelIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes('openai') || normalized.includes('gpt')) return 'openai';
  if (normalized.includes('flux')) return 'flux';
  if (normalized.includes('seedream') || normalized.includes('doubao')) return 'seedream';
  if (normalized.includes('gemini') || normalized.includes('imagen')) return 'google';
  if (normalized.includes('stable') || /\bsd\b/.test(normalized)) return 'stable';
  return 'model';
}
