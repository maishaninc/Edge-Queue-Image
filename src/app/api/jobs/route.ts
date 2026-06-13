import { NextResponse, type NextRequest } from 'next/server';
import { verifyCaptcha } from '@/lib/captcha';
import { createJob } from '@/lib/queue';
import { getClientIp, hashIp } from '@/lib/request';
import { resolveModel } from '@/lib/models';
import { areImageOptionsValid, normalizeImageOptions } from '@/lib/image-options';

const MAX_PROMPT_LENGTH = 4000;

type CreateJobBody = {
  prompt?: string;
  modelId?: string;
  captchaToken?: string;
  usePriority?: boolean;
  quality?: string;
  aspectRatio?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as CreateJobBody;
  const prompt = body.prompt?.trim() || '';
  const modelId = body.modelId || 'default';
  const ip = getClientIp(request);

  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
  }

  if (!resolveModel(modelId)) {
    return NextResponse.json({ error: 'model_not_found' }, { status: 400 });
  }

  if (!areImageOptionsValid({ quality: body.quality, aspectRatio: body.aspectRatio })) {
    return NextResponse.json({ error: 'invalid_image_options' }, { status: 400 });
  }

  const imageOptions = normalizeImageOptions({ quality: body.quality, aspectRatio: body.aspectRatio });

  const captcha = await verifyCaptcha(body.captchaToken, ip);
  if (!captcha.ok) {
    return NextResponse.json({ error: captcha.error || 'captcha_invalid' }, { status: 400 });
  }

  try {
    const created = await createJob({
      prompt,
      modelId,
      ipHash: hashIp(ip),
      usePriority: Boolean(body.usePriority),
      quality: imageOptions.quality,
      aspectRatio: imageOptions.aspectRatio,
    });

    if (!created.ok) {
      const status = created.error === 'queue_full' ? 429 : 400;
      return NextResponse.json({ error: created.error }, { status });
    }

    return NextResponse.json({ id: created.id, isPriority: created.isPriority });
  } catch {
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }
}
