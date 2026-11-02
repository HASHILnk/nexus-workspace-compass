// Client-side manager for personal AI API keys, model preferences, and rate limit quotas.
import { useState, useEffect, useCallback } from "react";

export type AiProvider = "gemini" | "openai" | "openrouter";

export interface ModelOption {
  id: string;
  name: string;
  provider: AiProvider;
  rpmLimit: number;
  rpdLimit: number;
  description: string;
  isFree?: boolean;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // Google Gemini
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "Fastest & stable (Recommended default, ~2s responses)",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "High volume throughput with fresh quota",
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "Experimental preview (frequently experiences Google 503 high demand)",
  },
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash Latest",
    provider: "gemini",
    rpmLimit: 15,
    rpdLimit: 1500,
    description: "Points to Google's standard Flash model",
  },
  // OpenAI
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
  // OpenRouter Free & Popular Models
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    provider: "openrouter",
    rpmLimit: 20,
    rpdLimit: 200,
    description: "Auto-routes to currently available free models with tool calling support (100% Free)",
    isFree: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google Gemma 4 31B (Free)",
    provider: "openrouter",
    rpmLimit: 20,
    rpdLimit: 200,
    description: "Next-gen open model by Google with tools support (Free)",
    isFree: true,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google Gemma 4 26B (Free)",
    provider: "openrouter",
    rpmLimit: 20,
    rpdLimit: 200,
    description: "Fast multimodal open model by Google (Free)",
    isFree: true,
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super (Free)",
    provider: "openrouter",
    rpmLimit: 20,
    rpdLimit: 200,
    description: "High-capability reasoning model by NVIDIA (Free)",
    isFree: true,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    name: "Meta Llama 3.3 70B",
    provider: "openrouter",
    rpmLimit: 30,
    rpdLimit: 500,
    description: "Flagship 70B parameter open intelligence by Meta",
  },
];

export interface UserAiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  customDailyLimit: number;
  connectedAt?: string;
  providerKeys?: Partial<Record<AiProvider, string>>;
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
    const cfg = JSON.parse(raw) as UserAiConfig;
    if (!cfg.providerKeys) {
      cfg.providerKeys = { [cfg.provider]: cfg.apiKey };
    }
    // Auto-migrate retired models
    if (
      cfg.model === "gemini-2.0-flash" ||
      cfg.model === "gemini-1.5-flash" ||
      cfg.model === "gemini-1.5-pro"
    ) {
      cfg.model = "gemini-2.5-flash";
      saveUserAiConfig(cfg);
    }
    if (
      cfg.provider === "openrouter" &&
      (cfg.model === "meta-llama/llama-3.3-70b-instruct:free" ||
        cfg.model === "google/gemini-2.0-flash-exp:free" ||
        cfg.model === "deepseek/deepseek-r1:free" ||
        cfg.model === "deepseek/deepseek-chat:free" ||
        cfg.model === "qwen/qwen-2.5-72b-instruct:free" ||
        cfg.model === "mistralai/mistral-small-24b-instruct-2501:free")
    ) {
      cfg.model = "openrouter/free";
      saveUserAiConfig(cfg);
    }
    return cfg;
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
