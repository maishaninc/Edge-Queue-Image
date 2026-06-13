export type ImageModelConfig = {
  id: string;
  name: string;
  api: string;
  key: string;
};

export type PublicModel = {
  id: string;
  name: string;
};

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

export function getPublicModels(models = getModelConfigs()): PublicModel[] {
  return models.map((model) => ({ id: model.id, name: model.name }));
}

export function resolveModel(modelId: string, models = getModelConfigs()) {
  return models.find((model) => model.id === modelId);
}
