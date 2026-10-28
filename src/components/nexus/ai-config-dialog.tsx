import { useState, useEffect } from "react";
import {
  Key,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
  ExternalLink,
  Sliders,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AVAILABLE_MODELS,
  openAiConfigDialog,
  useUserAiConfig,
  type AiProvider,
} from "@/lib/ai/user-ai-config";
import { cn } from "@/lib/utils";

/** Header button placed on the top bar in the marked area */
export function AiConfigHeaderButton() {
  const { isConnected, stats } = useUserAiConfig();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={openAiConfigDialog}
      className={cn(
        "h-9 gap-1.5 px-3 text-xs font-medium transition-all shadow-none",
        isConnected
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
          : "border-border/80 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
      aria-label="Configure AI API Key"
      title={isConnected ? `AI Connected (${stats.model.name}) - Click to configure` : "Configure your AI API key"}
    >
      {isConnected ? (
        <>
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Connected</span>
          <span className="hidden text-[11px] font-normal text-muted-foreground lg:inline">
            ({stats.model.name.replace("Gemini ", "").replace("Flash", "Fl.")})
          </span>
        </>
      ) : (
        <>
          <Key className="size-3.5 text-primary" />
          <span className="hidden sm:inline">Configure AI</span>
          <span className="sm:hidden">API Key</span>
        </>
      )}
    </Button>
  );
}

/** Visual limit bar for display inside or on the side of the chat */
export function AiLimitBar({ className }: { className?: string }) {
  const { isConnected, stats, resetUsage } = useUserAiConfig();

  const rpmRatio = stats.rpmCount / Math.max(1, stats.rpmLimit);
  const dailyRatio = stats.dailyCount / Math.max(1, stats.dailyLimit);
  const highestRatio = Math.max(rpmRatio, dailyRatio);

  const statusColor =
    highestRatio >= 0.85
      ? "bg-destructive"
      : highestRatio >= 0.6
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b bg-card/60 px-3.5 py-2 text-xs backdrop-blur",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
            )}
          />
          <span className="truncate font-medium text-foreground">
            {isConnected ? stats.model.name : "Not Configured"}
          </span>
          {isConnected ? (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[10px] font-normal text-muted-foreground border-emerald-500/30"
            >
              Connected
            </Badge>
          ) : (
            <button
              onClick={openAiConfigDialog}
              className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 hover:bg-amber-500/20 dark:text-amber-400"
            >
              Connect API Key
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          {isConnected ? (
            <>
              <span className="text-[11px]">
                <span className="font-semibold text-foreground">{stats.rpmCount}</span>/
                {stats.rpmLimit} RPM
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[11px]">
                <span className="font-semibold text-foreground">{stats.dailyCount}</span>/
                {stats.dailyLimit} Day
              </span>
            </>
          ) : (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              API key required
            </span>
          )}
          <button
            onClick={openAiConfigDialog}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Configure API key and limits"
            aria-label="Configure API Key"
          >
            <Sliders className="size-3" />
          </button>
        </div>
      </div>

      {/* Limit progress bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn("h-full transition-all duration-300 rounded-full", statusColor)}
          style={{ width: `${Math.min(100, Math.max(4, highestRatio * 100))}%` }}
        />
      </div>

      {/* Warning message if close to rate limit */}
      {stats.isNearRpmLimit && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">
            Pacing limit: wait a few seconds between prompts to prevent 429 errors.
          </span>
        </div>
      )}
    </div>
  );
}

/** Full modal dialog for entering custom API key, selecting model, and viewing/resetting limits */
export function AiConfigDialog() {
  const [open, setOpen] = useState(false);
  const { config, stats, isConnected, saveConfig, clearConfig, resetUsage } =
    useUserAiConfig();

  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [dailyLimit, setDailyLimit] = useState<number>(50);
  const [showKey, setShowKey] = useState(false);

  // Sync state when modal opens or config updates
  useEffect(() => {
    if (config) {
      setProvider(config.provider || "gemini");
      setApiKey(config.apiKey || "");
      setModel(config.model || "gemini-2.5-flash");
      setDailyLimit(config.customDailyLimit || 50);
    } else {
      setProvider("gemini");
      setApiKey("");
      setModel("gemini-2.5-flash");
      setDailyLimit(50);
    }
  }, [config, open]);

  // Listen to open event
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-nexus-ai-config", handleOpen);
    return () => window.removeEventListener("open-nexus-ai-config", handleOpen);
  }, []);

  // Filter models by provider
  const filteredModels = AVAILABLE_MODELS.filter((m) => m.provider === provider);

  // Auto-detect provider if user pastes standard key
  const handleKeyChange = (val: string) => {
    setApiKey(val);
    const trimmed = val.trim();
    if (trimmed.startsWith("sk-") && provider !== "openai") {
      setProvider("openai");
      setModel("gpt-4o");
    } else if ((trimmed.startsWith("AIza") || trimmed.startsWith("AQ.")) && provider !== "gemini") {
      setProvider("gemini");
      setModel("gemini-2.5-flash");
    }
  };

  const handleProviderChange = (p: AiProvider) => {
    setProvider(p);
    const defaultModel = p === "gemini" ? "gemini-2.5-flash" : "gpt-4o";
    setModel(defaultModel);
  };

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error("Please enter a valid API key.");
      return;
    }

    saveConfig({
      provider,
      apiKey: trimmed,
      model,
      customDailyLimit: Number(dailyLimit) || 50,
    });

    toast.success(`Connected successfully to ${provider === "gemini" ? "Google Gemini" : "OpenAI"}!`);
    setOpen(false);
  };

  const handleReset = () => {
    clearConfig();
    setApiKey("");
    toast.success("AI configuration and limits reset successfully.");
    setOpen(false);
  };

  const selectedModelInfo =
    AVAILABLE_MODELS.find((m) => m.id === model) || filteredModels[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Configure Personal AI</DialogTitle>
              <DialogDescription className="text-xs">
                Use your own API key to bypass workspace limits and choose your preferred model.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1 text-sm">
          {/* Provider Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">AI Provider</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleProviderChange("gemini")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                  provider === "gemini"
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <Zap className="size-3.5" />
                <span>Google Gemini</span>
              </button>
              <button
                type="button"
                onClick={() => handleProviderChange("openai")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                  provider === "openai"
                    ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <Sparkles className="size-3.5" />
                <span>OpenAI</span>
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                {provider === "gemini" ? "Gemini API Key" : "OpenAI API Key"}
              </Label>
              {provider === "gemini" ? (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Get free Gemini key <ExternalLink className="size-2.5" />
                </a>
              ) : (
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Get OpenAI key <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={
                  provider === "gemini"
                    ? "AIzaSy... or AQ.Ab8..."
                    : "sk-proj-..."
                }
                value={apiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your key is saved locally in your browser and used securely for your AI requests.
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs">Available Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {filteredModels.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {m.description} · Limit: {m.rpmLimit} RPM
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Person Limit & Usage Section */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Your Personal Limits & Quota
              </span>
              <button
                type="button"
                onClick={resetUsage}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                title="Reset usage counter"
              >
                <RotateCcw className="size-3" />
                <span>Reset counter</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border bg-background/80 p-2">
                <div className="text-[11px] text-muted-foreground">Rate Limit (Rolling 60s)</div>
                <div className="mt-0.5 text-sm font-semibold">
                  {stats.rpmCount} / {selectedModelInfo?.rpmLimit ?? 15}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">RPM</span>
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      stats.rpmPercent >= 80
                        ? "bg-destructive"
                        : stats.rpmPercent >= 50
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    )}
                    style={{ width: `${stats.rpmPercent}%` }}
                  />
                </div>
              </div>

              <div className="rounded-md border bg-background/80 p-2">
                <div className="text-[11px] text-muted-foreground">Used Today</div>
                <div className="mt-0.5 text-sm font-semibold">
                  {stats.dailyCount} / {dailyLimit}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">Requests</span>
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      stats.dailyPercent >= 80
                        ? "bg-destructive"
                        : stats.dailyPercent >= 50
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    )}
                    style={{ width: `${stats.dailyPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                Personal daily safety cap (requests / day)
              </Label>
              <Input
                type="number"
                min={5}
                max={1500}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="h-8 text-xs w-32"
              />
            </div>

            <p className="text-[10px] text-muted-foreground">
              Tip: The free Gemini tier allows up to 15 requests/minute. Space your messages 4-5 seconds apart to prevent 429 errors.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          {isConnected ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              <span>Reset & Disconnect</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="gap-1.5 text-xs"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Save & Connect</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
