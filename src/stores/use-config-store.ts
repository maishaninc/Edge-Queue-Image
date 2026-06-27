"use client";

import { create } from "zustand";

import type { PublicSettings } from "@/lib/settings-defaults";
import { api } from "@/services/api/request";

export type GenConfig = {
  imageModel: string;
  quality: string;
  size: string;
  count: string;
};

const DEFAULT_CONFIG: GenConfig = {
  imageModel: "",
  quality: "auto",
  size: "1024x1024",
  count: "1",
};

type ConfigStore = {
  publicSettings: PublicSettings | null;
  config: GenConfig;
  loadPublic: () => Promise<void>;
  updateConfig: (patch: Partial<GenConfig>) => void;
};

export const useConfigStore = create<ConfigStore>()((set, get) => ({
  publicSettings: null,
  config: DEFAULT_CONFIG,
  loadPublic: async () => {
    try {
      const { data } = await api.get<PublicSettings>("/api/config");
      const config = get().config;
      const models = data.models;
      const imageModel =
        config.imageModel || models?.defaultImageModel || models?.availableModels?.[0] || "";
      const quality =
        config.quality && models?.qualities?.includes(config.quality)
          ? config.quality
          : models?.qualities?.[0] || "auto";
      const size =
        config.size && models?.sizes?.includes(config.size)
          ? config.size
          : models?.sizes?.[0] || "1024x1024";
      set({ publicSettings: data, config: { ...config, imageModel, quality, size } });
    } catch {
      // ignore — UI shows a loading state until config is available
    }
  },
  updateConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
}));
