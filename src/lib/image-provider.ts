import type { ImageModelConfig } from './models';
import { normalizeImageOptions, type ImageAspectRatio, type ImageQuality } from './image-options';

export type GenerateImageInput = {
  model: ImageModelConfig;
  prompt: string;
  count: number;
  quality: ImageQuality;
  aspectRatio: ImageAspectRatio;
};

export type GenerateImageResult = {
  url?: string;
  b64?: string;
};

type OpenAIImageResponse = {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
};

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const { size } = normalizeImageOptions({ quality: input.quality, aspectRatio: input.aspectRatio });

  const response = await fetch(`${input.model.api}/v1/images/generations`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.model.key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model.name,
      prompt: input.prompt,
      size,
      n: input.count,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as OpenAIImageResponse;

  if (!response.ok) {
    const message = data.error?.code || data.error?.message || `provider_http_${response.status}`;
    throw new Error(message);
  }

  const first = data.data?.[0];
  if (!first?.url && !first?.b64_json) {
    throw new Error('provider_empty_result');
  }

  return {
    url: first.url,
    b64: first.b64_json,
  };
}
