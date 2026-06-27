"use client";

import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

type AspectOption = { value: string; label: string; w: number; h: number };

const ASPECT_OPTIONS: AspectOption[] = [
  { value: "1024x1024", label: "1:1", w: 1024, h: 1024 },
  { value: "1536x1024", label: "3:2", w: 1536, h: 1024 },
  { value: "1024x1536", label: "2:3", w: 1024, h: 1536 },
  { value: "1792x1024", label: "16:9", w: 1792, h: 1024 },
  { value: "1024x1792", label: "9:16", w: 1024, h: 1792 },
  { value: "auto", label: "auto", w: 0, h: 0 },
];

const QUALITY_LABELS_ZH: Record<string, string> = { auto: "自动", high: "高", medium: "中", low: "低" };
const QUALITY_LABELS_EN: Record<string, string> = { auto: "Auto", high: "High", medium: "Medium", low: "Low" };

type ImageSettingsPanelProps = {
  quality: string;
  size: string;
  count: string;
  qualities?: string[];
  maxCount?: number;
  onChange: (key: "quality" | "size" | "count", value: string) => void;
};

export function ImageSettingsPanel({
  quality,
  size,
  count,
  qualities = ["auto", "high", "medium", "low"],
  maxCount = 4,
  onChange,
}: ImageSettingsPanelProps) {
  const { locale } = useI18n();
  const activeSize = size || "auto";
  const activeCount = Math.max(1, Math.min(maxCount, Math.floor(Number(count) || 1)));
  const qualityLabel = (value: string) =>
    (locale === "en-US" ? QUALITY_LABELS_EN : QUALITY_LABELS_ZH)[value] || value;

  return (
    <div className="space-y-5">
      <Section title={locale === "en-US" ? "Quality" : "质量"}>
        <div className="grid grid-cols-4 gap-2.5">
          {qualities.map((item) => (
            <Pill key={item} selected={quality === item} onClick={() => onChange("quality", item)}>
              {qualityLabel(item)}
            </Pill>
          ))}
        </div>
      </Section>

      <Section title={locale === "en-US" ? "Aspect ratio" : "宽高比"}>
        <div className="grid grid-cols-3 gap-2.5">
          {ASPECT_OPTIONS.map((item) => {
            const selected = activeSize === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onChange("size", item.value)}
                className={cn(
                  "flex h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border bg-transparent text-sm transition hover:opacity-80",
                  selected ? "border-foreground text-foreground" : "border-border text-muted-foreground",
                )}
              >
                <AspectIcon w={item.w} h={item.h} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={locale === "en-US" ? "Image count" : "生成张数"}>
        <div className="grid grid-cols-4 gap-2.5">
          {Array.from({ length: maxCount }, (_, index) => index + 1).map((value) => (
            <Pill key={value} selected={activeCount === value} onClick={() => onChange("count", String(value))}>
              {locale === "en-US" ? `${value}` : `${value} 张`}
            </Pill>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80",
        selected ? "border-foreground text-foreground" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function AspectIcon({ w, h }: { w: number; h: number }) {
  if (!w || !h) return <span className="grid h-7 w-9 place-items-center text-xs opacity-60">auto</span>;
  const ratio = w / Math.max(1, h);
  const boxWidth = ratio >= 1 ? 24 : Math.max(10, 24 * ratio);
  const boxHeight = ratio >= 1 ? Math.max(10, 24 / ratio) : 24;
  return (
    <span className="grid h-7 w-9 place-items-center">
      <span className="border-2 border-current" style={{ width: boxWidth, height: boxHeight }} />
    </span>
  );
}

export function imageQualityLabel(value: string) {
  return QUALITY_LABELS_ZH[value] || value;
}
