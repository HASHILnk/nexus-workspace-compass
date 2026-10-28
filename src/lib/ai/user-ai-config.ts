// Client-side manager for personal AI API keys, model preferences, and rate limit quotas.
import { useState, useEffect, useCallback } from "react";

export type AiProvider = "gemini" | "openai";

export interface ModelOption {
  id: string;
  name: string;
  provider: AiProvider;
  rpmLimit: number;
  rpdLimit: number;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "Fast, intelligent & versatile (Recommended default)",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "Ultra-fast response with high rate limits",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "High-volume throughput & 1M token window",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "gemini",
    rpmLimit: 2,
    rpdLimit: 50,
    description: "Deep reasoning & analysis (Free tier: 2 RPM)",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    rpmLimit: 500,
    rpdLimit: 10000,
    description: "OpenAI flagship omni intelligence",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    rpmLimit: 500,
    rpdLimit: 10000,
    description: "Affordable and fast OpenAI model",
  },
];

export interface UserAiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  customDailyLimit: number;
  connectedAt?: string;
}

interface StoredUsage {
  date: string;
  dailyCount: number;
  recentTimestamps: number[];
}

const STORAGE_KEY_CONFIG = "nexus_ai_user_config";
const STORAGE_KEY_USAGE = "nexus_ai_user_usage";
const EVENT_NAME = "nexus-ai-config-changed";
const EVENT_OPEN_DIALOG = "open-nexus-ai-config";

export function openAiConfigDialog() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_OPEN_DIALOG));
  }
}

export function getUserAiConfig(): UserAiConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return null;
    return JSON.parse(raw) as UserAiConfig;
  } catch {
    return null;
  }
}

export function saveUserAiConfig(config: UserAiConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY_CONFIG,
    JSON.stringify({ ...config, connectedAt: new Date().toISOString() })
  );
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function clearUserAiConfig() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY_CONFIG);
  resetAiUsage();
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getStoredUsage(): StoredUsage {
  const today = new Date().toISOString().slice(0, 10);
  if (typeof window === "undefined") {
    return { date: today, dailyCount: 0, recentTimestamps: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USAGE);
    if (!raw) return { date: today, dailyCount: 0, recentTimestamps: [] };
    const parsed = JSON.parse(raw) as StoredUsage;
    const now = Date.now();
    const validTimestamps = (parsed.recentTimestamps || []).filter(
      (ts) => now - ts < 60_000
    );
    if (parsed.date !== today) {
      return { date: today, dailyCount: 0, recentTimestamps: validTimestamps };
    }
    return { ...parsed, recentTimestamps: validTimestamps };
  } catch {
    return { date: today, dailyCount: 0, recentTimestamps: [] };
  }
}

export function recordAiRequest() {
  if (typeof window === "undefined") return;
  const current = getStoredUsage();
  const now = Date.now();
  const updatedTimestamps = [...current.recentTimestamps, now].filter(
    (ts) => now - ts < 60_000
  );
  const updated: StoredUsage = {
    date: current.date,
    dailyCount: current.dailyCount + 1,
    recentTimestamps: updatedTimestamps,
  };
  localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(updated));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function resetAiUsage() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const reset: StoredUsage = { date: today, dailyCount: 0, recentTimestamps: [] };
  localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(reset));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export interface LimitStats {
  rpmCount: number;
  rpmLimit: number;
  rpmPercent: number;
  dailyCount: number;
  dailyLimit: number;
  dailyPercent: number;
  isNearRpmLimit: boolean;
  model: ModelOption;
}

export function useUserAiConfig() {
  const [config, setConfig] = useState<UserAiConfig | null>(() => getUserAiConfig());
  const [usage, setUsage] = useState<StoredUsage>(() => getStoredUsage());

  const refresh = useCallback(() => {
    setConfig(getUserAiConfig());
    setUsage(getStoredUsage());
  }, []);

  useEffect(() => {
    refresh();
    const handleEvent = () => refresh();
    window.addEventListener(EVENT_NAME, handleEvent);
    window.addEventListener("storage", handleEvent);

    // Refresh every 5s to prune rolling 60-second RPM window
    const interval = setInterval(() => {
      setUsage(getStoredUsage());
    }, 5000);

    return () => {
      window.removeEventListener(EVENT_NAME, handleEvent);
      window.removeEventListener("storage", handleEvent);
      clearInterval(interval);
    };
  }, [refresh]);

  const activeModelId = config?.model || "gemini-2.5-flash";
  const activeModel =
    AVAILABLE_MODELS.find((m) => m.id === activeModelId) || AVAILABLE_MODELS[0]!;

  const rpmLimit = activeModel.rpmLimit;
  const rpmCount = usage.recentTimestamps.length;
  const rpmPercent = Math.min(100, Math.round((rpmCount / rpmLimit) * 100));

  const dailyLimit = config?.customDailyLimit || 50;
  const dailyCount = usage.dailyCount;
  const dailyPercent = Math.min(100, Math.round((dailyCount / dailyLimit) * 100));

  const isNearRpmLimit = rpmCount >= Math.max(1, rpmLimit - 2);
  const isConnected = Boolean(config?.apiKey?.trim());

  const stats: LimitStats = {
    rpmCount,
    rpmLimit,
    rpmPercent,
    dailyCount,
    dailyLimit,
    dailyPercent,
    isNearRpmLimit,
    model: activeModel,
  };

  return {
    config,
    usage,
    stats,
    isConnected,
    saveConfig: saveUserAiConfig,
    clearConfig: clearUserAiConfig,
    resetUsage: resetAiUsage,
    refresh,
  };
}
