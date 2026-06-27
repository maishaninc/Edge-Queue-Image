"use client";

import { useEffect, useRef, type CSSProperties } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSlotProps = {
  client: string;
  slot?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
};

/** A Google AdSense ad unit. Renders a dashed placeholder when not configured. */
export function AdSlot({ client, slot, className, style, label = "广告位" }: AdSlotProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet — ignore.
    }
  }, [client]);

  if (!client) {
    return (
      <div className={className} style={style}>
        <div className="grid size-full place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          {label}
        </div>
      </div>
    );
  }

  return (
    <ins
      className={`adsbygoogle ${className || ""}`}
      style={{ display: "block", ...style }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

/** Extract the AdSense publisher id (ca-pub-…) from a pasted loader snippet. */
export function extractAdClient(code: string | undefined): string {
  if (!code) return "";
  const match = /client=(ca-pub-\d+)/.exec(code) || /data-ad-client="(ca-pub-\d+)"/.exec(code);
  return match?.[1] || "";
}
