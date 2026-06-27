"use client";

import { Cpu } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useI18n } from "@/hooks/use-i18n";
import { cn } from "@/lib/utils";

type ModelPickerProps = {
  models: string[];
  value?: string;
  onChange: (model: string) => void;
  className?: string;
  fullWidth?: boolean;
};

export function ModelPicker({ models, value, onChange, className, fullWidth = true }: ModelPickerProps) {
  const { locale } = useI18n();
  const options = Array.from(new Set(models.filter(Boolean)));
  const current = value || "";

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "h-9 max-w-full gap-2 rounded-full border border-input bg-transparent px-3 text-sm font-normal",
          fullWidth ? "w-full min-w-0 justify-start" : "min-w-[9rem] justify-start",
          className,
        )}
        title={current}
      >
        <Cpu className="size-4 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate text-left">
          {current || (locale === "en-US" ? "Select model" : "选择模型")}
        </span>
      </SelectTrigger>
      <SelectContent
        className="z-[1200] w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border/70 bg-popover p-1 shadow-xl"
        position="popper"
        align="start"
        side="bottom"
        sideOffset={6}
      >
        {options.length ? (
          options.map((model) => (
            <SelectItem key={model} value={model} textValue={model}>
              <span className="flex min-w-0 items-center gap-2">
                <Cpu className="size-4 shrink-0 opacity-70" />
                <span className="truncate">{model}</span>
              </span>
            </SelectItem>
          ))
        ) : (
          <SelectItem value="__empty__" disabled>
            {locale === "en-US" ? "No available model is configured" : "管理员尚未配置可用模型"}
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
