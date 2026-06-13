export const IMAGE_QUALITIES = ['1K', '2K', '4K'] as const;
export const IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const;

export type ImageQuality = (typeof IMAGE_QUALITIES)[number];
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];

const SIZE_MAP: Record<ImageQuality, Record<ImageAspectRatio, string>> = {
  '1K': {
    '1:1': '1024x1024',
    '16:9': '1024x576',
    '9:16': '576x1024',
    '4:3': '1024x768',
    '3:4': '768x1024',
  },
  '2K': {
    '1:1': '2048x2048',
    '16:9': '2048x1152',
    '9:16': '1152x2048',
    '4:3': '2048x1536',
    '3:4': '1536x2048',
  },
  '4K': {
    '1:1': '4096x4096',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '4:3': '4096x3072',
    '3:4': '3072x4096',
  },
};

export function isImageQuality(value: unknown): value is ImageQuality {
  return typeof value === 'string' && IMAGE_QUALITIES.includes(value as ImageQuality);
}

export function isImageAspectRatio(value: unknown): value is ImageAspectRatio {
  return typeof value === 'string' && IMAGE_ASPECT_RATIOS.includes(value as ImageAspectRatio);
}

export function normalizeImageOptions(input: { quality?: unknown; aspectRatio?: unknown }) {
  const quality = isImageQuality(input.quality) ? input.quality : '1K';
  const aspectRatio = isImageAspectRatio(input.aspectRatio) ? input.aspectRatio : '1:1';

  return {
    quality,
    aspectRatio,
    size: SIZE_MAP[quality][aspectRatio],
  };
}

export function areImageOptionsValid(input: { quality?: unknown; aspectRatio?: unknown }) {
  return (
    (input.quality === undefined || isImageQuality(input.quality)) &&
    (input.aspectRatio === undefined || isImageAspectRatio(input.aspectRatio))
  );
}
