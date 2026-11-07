import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type UIMessage,
  type TextUIPart,
} from "ai";
import {
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Clock,
  Copy,
  FileText,
  FolderKanban,
  GanttChart,
  Hexagon,
  History,
  Languages,
  LayoutGrid,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  PhoneCall,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { MessageResponse } from "@/components/ai-elements/message";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { memberById } from "@/lib/selectors";
import { ROLE_LABEL } from "@/lib/permissions";
import { createThread, deleteThread, getThreadMessages, listThreads } from "@/lib/ai.functions";
import { BulkChangesCard, PlanCard, ProjectsMini, SavedTaskCard, TaskRows } from "./ai-cards";
import { SarvamVoiceModal } from "./sarvam-voice-modal";
import {
  getUserAiConfig,
  openAiConfigDialog,
  recordAiRequest,
  useUserAiConfig,
} from "@/lib/ai/user-ai-config";
import { SUPPORTED_VOICE_LANGUAGES, useSpeechToText, useTextToSpeech } from "@/lib/ai/voice";
import { MemberAvatar, colorClass } from "./bits";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  {
    id: "project-insights",
    title: "Project Insights",
    desc: "Summarize project progress and identify blockers.",
    prompt: "Summarize project progress and identify blockers across all workspace projects.",
  },
  {
    id: "team-availability",
    title: "Team Availability",
    desc: "Find unassigned team members and workload gaps.",
    prompt: "Find unassigned team members and identify workload gaps across our team.",
  },
  {
    id: "task-planning",
    title: "Task Planning",
    desc: "Create and assign tasks from natural-language instructions.",
    prompt:
      "Help me plan and break down the top priorities into assigned tasks for our current milestone.",
  },
];

const TOOL_LABEL: Record<string, string> = {
  get_team_workload: "Checked team workload",
  list_projects: "Read projects",
  search_tasks: "Searched tasks",
  get_recent_activity: "Read activity",
  create_task: "Created task",
  update_task: "Updated task",
  propose_bulk_changes: "Proposed changes",
  propose_project_plan: "Drafted plan",
};

interface AiWorkspaceViewProps {
  routeThreadId?: string;
}

export function AiWorkspaceView({ routeThreadId }: AiWorkspaceViewProps) {
  const { ui } = useStore();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);
  const threadsQuery = useQuery({ queryKey: ["ai-threads"], queryFn: () => list() });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    if (routeThreadId) return routeThreadId;
    if (typeof window !== "undefined") {
      return localStorage.getItem("nexus_active_ai_thread");
    }
    return null;
  });
  const [sarvamCallOpen, setSarvamCallOpen] = useState(false);
  const [newChatSessionCounter, setNewChatSessionCounter] = useState(0);

  // Sync routeThreadId if changed via URL
  useEffect(() => {
    if (routeThreadId) {
      setActiveThreadId(routeThreadId);
      localStorage.setItem("nexus_active_ai_thread", routeThreadId);
    } else {
      setActiveThreadId(null);
    }
  }, [routeThreadId]);

  // Auto-restore previous active thread when refreshing /ai if saved in localStorage
  useEffect(() => {
    if (routeThreadId) return;

    if (!threadsQuery.data || threadsQuery.data.length === 0) return;

    const savedId = localStorage.getItem("nexus_active_ai_thread");
    const threadExists = savedId && threadsQuery.data.some((t) => t.id === savedId);

    if (threadExists && savedId) {
      setActiveThreadId(savedId);
      void navigate({ to: "/ai/$threadId", params: { threadId: savedId }, replace: true });
    }
  }, [threadsQuery.data, routeThreadId, navigate]);

  const openThread = (id: string) => {
    localStorage.setItem("nexus_active_ai_thread", id);
    setActiveThreadId(id);
    void navigate({ to: "/ai/$threadId", params: { threadId: id } });
  };

  const handleNewChat = () => {
    localStorage.removeItem("nexus_active_ai_thread");
    setActiveThreadId(null);
    setNewChatSessionCounter((c) => c + 1);
    void navigate({ to: "/ai" });
  };

  const handleDeleteThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await remove({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["ai-threads"] });
      if (id === activeThreadId) {
        localStorage.removeItem("nexus_active_ai_thread");
        setActiveThreadId(null);
        setNewChatSessionCounter((c) => c + 1);
        void navigate({ to: "/ai" });
      }
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(`Couldn't delete conversation: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-white relative overflow-hidden">
      {/* Workspace Top Bar */}
      <WorkspaceHeader
        sidebarOpen={ui.sidebarOpen}
        onToggleSidebar={() => ui.setSidebarOpen((v) => !v)}
        onOpenMobileSidebar={() => ui.setMobileNav(true)}
        onStartVoiceCall={() => setSarvamCallOpen(true)}
        onNewChat={handleNewChat}
        threads={threadsQuery.data ?? []}
        activeThreadId={activeThreadId}
        onSelectThread={openThread}
        onDeleteThread={handleDeleteThread}
      />

      {/* Workspace Chat Canvas */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <WorkspaceBody
          threadId={activeThreadId}
          sessionCounter={newChatSessionCounter}
          onThreadCreated={(newId) => {
            localStorage.setItem("nexus_active_ai_thread", newId);
            setActiveThreadId(newId);
            window.history.replaceState(null, "", `/ai/${newId}`);
            void qc.invalidateQueries({ queryKey: ["ai-threads"] });
          }}
        />
      </div>

      {/* Sarvam AI Voice Call Modal */}
      <SarvamVoiceModal open={sarvamCallOpen} onOpenChange={setSarvamCallOpen} />
    </div>
  );
}

// ============================================================================
// 3. Workspace Header
// ============================================================================
interface WorkspaceHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onStartVoiceCall: () => void;
  onNewChat: () => void;
  threads: Array<{ id: string; title: string; updated_at?: string }>;
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string, e: React.MouseEvent) => void;
}

function WorkspaceHeader({
  sidebarOpen,
  onToggleSidebar,
  onOpenMobileSidebar,
  onStartVoiceCall,
  onNewChat,
  threads,
  activeThreadId,
  onSelectThread,
  onDeleteThread,
}: WorkspaceHeaderProps) {
  const { stats, isConnected } = useUserAiConfig();

  return (
    <header className="h-14 border-b border-[#EAEAEA] pl-4 sm:pl-6 pr-2 sm:pr-3 flex items-center justify-between shrink-0 bg-white z-10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] flex items-center justify-center transition-colors"
        >
          <Menu className="size-4" />
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:flex size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] items-center justify-center transition-colors"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </button>

        <span className="text-xs font-medium text-[#777777]">Nexus AI Workspace</span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Model & Limit Badge */}
        <button
          type="button"
          onClick={openAiConfigDialog}
          className="h-7 px-2.5 rounded-full border border-[#EAEAEA] bg-[#FAFAFA] hover:bg-[#F0F0F0] text-[#111111] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Click to configure AI models and API keys"
        >
          <span
            className={cn("size-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-amber-500")}
          />
          <span className="font-medium text-[11px] truncate max-w-[140px]">
            {isConnected
              ? stats.model.name.replace("Gemini ", "").replace(" (Free)", "")
              : "Configure AI"}
          </span>
        </button>

        {/* Live Voice Call Agent Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStartVoiceCall}
          className="h-7 gap-1.5 px-3 rounded-full text-xs border-[#EAEAEA] bg-[#FAFAFA] hover:bg-[#F0F0F0] text-[#111111]"
          title="Start voice call with conversational AI agent"
        >
          <PhoneCall className="size-3 text-emerald-600" />
          <span className="font-medium">Call Agent</span>
        </Button>

        {/* New Chat icon */}
        <button
          type="button"
          onClick={onNewChat}
          className="size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] flex items-center justify-center transition-colors cursor-pointer"
          title="Start fresh conversation"
        >
          <Plus className="size-4" />
        </button>

        {/* History button placed on right side of + icon */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-8 rounded-lg text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] flex items-center justify-center transition-colors cursor-pointer"
              title="Conversation history"
              aria-label="Conversation history"
            >
              <History className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 p-1.5 bg-white border border-[#EAEAEA] shadow-lg rounded-xl z-50"
          >
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#F0F0F0] mb-1">
              <span className="text-xs font-semibold text-[#111111]">Conversations</span>
              <button
                type="button"
                onClick={onNewChat}
                className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3" />
                <span>New</span>
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-0.5">
              {threads.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[#888888]">
                  No conversations yet
                </div>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer",
                      t.id === activeThreadId
                        ? "bg-[#F4F4F5] text-[#111111] font-medium"
                        : "text-[#444444] hover:bg-[#FAFAFA] hover:text-[#111111]",
                    )}
                    onClick={() => onSelectThread(t.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className="size-3.5 shrink-0 text-[#888888] group-hover:text-[#111111]" />
                      <span className="truncate">{t.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => onDeleteThread(t.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#999999] hover:text-red-600 rounded transition-all cursor-pointer"
                      title="Delete conversation"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ============================================================================
// AI Limit Circular Gauge Indicator with Dual-Limit Tooltip on Hover
// ============================================================================
function AiLimitCircle() {
  const { stats } = useUserAiConfig();

  const rpmRatio = stats.rpmCount / Math.max(1, stats.rpmLimit);
  const dailyRatio = stats.dailyCount / Math.max(1, stats.dailyLimit);
  const highestRatio = Math.max(rpmRatio, dailyRatio);

  const statusStroke =
    highestRatio >= 0.85
      ? "stroke-rose-500"
      : highestRatio >= 0.6
        ? "stroke-amber-500"
        : "stroke-emerald-500";

  const statusBg =
    highestRatio >= 0.85 ? "bg-rose-500" : highestRatio >= 0.6 ? "bg-amber-500" : "bg-emerald-500";

  // Radius 6.5 -> Circumference ~40.84
  const radius = 6.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(1, Math.max(0, dailyRatio)) * circumference;

  return (
    <TooltipProvider delayDuration={80}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openAiConfigDialog}
            className="group relative size-6.5 rounded-full flex items-center justify-center hover:bg-[#F0F0F0]/80 transition-all cursor-pointer focus:outline-none"
            aria-label="View AI usage and limits"
          >
            {/* SVG Circular Ring Gauge */}
            <svg className="size-4.5 -rotate-90" viewBox="0 0 18 18">
              <circle
                cx="9"
                cy="9"
                r={radius}
                className="stroke-[#E2E4E8] fill-none"
                strokeWidth="1.8"
              />
              <circle
                cx="9"
                cy="9"
                r={radius}
                className={cn("fill-none transition-all duration-300", statusStroke)}
                strokeWidth="1.8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>

            {/* Inner Center Status Dot */}
            <span
              className={cn(
                "absolute size-1.5 rounded-full transition-transform duration-200 group-hover:scale-125",
                statusBg,
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-64 p-3 bg-white text-[#111111] border border-[#EAEAEA] shadow-xl rounded-xl z-50 text-left select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0F0F0]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn("size-2 rounded-full shrink-0", statusBg)} />
              <span className="font-semibold text-xs text-[#111111] truncate">
                {stats.model.name}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#777777] bg-[#F5F5F5] px-1.5 py-0.5 rounded">
              Limits
            </span>
          </div>

          {/* Both Limits */}
          <div className="space-y-2.5">
            {/* 1. Rate Limit (Rolling 60s / RPM) */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#666666] font-medium">Rate Limit (60s)</span>
                <span className="font-semibold text-[#111111]">
                  {stats.rpmCount}{" "}
                  <span className="font-normal text-[#888888]">/ {stats.rpmLimit} RPM</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    rpmRatio >= 0.85
                      ? "bg-rose-500"
                      : rpmRatio >= 0.6
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(rpmRatio > 0 ? 6 : 0, rpmRatio * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* 2. Daily Limit / Quota */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[#666666] font-medium">Daily Limit</span>
                <span className="font-semibold text-[#111111]">
                  {stats.dailyCount}{" "}
                  <span className="font-normal text-[#888888]">/ {stats.dailyLimit} Day</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    dailyRatio >= 0.85
                      ? "bg-rose-500"
                      : dailyRatio >= 0.6
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(dailyRatio > 0 ? 6 : 0, dailyRatio * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-2.5 pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-[10px] text-[#888888]">
            <span>Click to configure limits</span>
            <span className="text-emerald-600 font-medium">Configure →</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// 4. Workspace Body (Chat & Initial Empty State)
// ============================================================================
interface WorkspaceBodyProps {
  threadId: string | null;
  sessionCounter?: number;
  onThreadCreated: (id: string) => void;
}

function WorkspaceBody({ threadId, sessionCounter = 0, onThreadCreated }: WorkspaceBodyProps) {
  const qc = useQueryClient();
  const get = useServerFn(getThreadMessages);
  const q = useQuery({
    queryKey: ["ai-thread", threadId],
    queryFn: () => (threadId ? get({ data: { id: threadId } }) : Promise.resolve(null)),
    enabled: Boolean(threadId),
  });

  const inSessionThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!threadId) {
      inSessionThreadIdRef.current = null;
    }
  }, [threadId]);

  const handleThreadCreated = (newId: string) => {
    inSessionThreadIdRef.current = newId;
    qc.setQueryData(["ai-thread", newId], { found: true, messagesJson: "[]" });
    onThreadCreated(newId);
  };

  const isNewInSession = Boolean(threadId && inSessionThreadIdRef.current === threadId);

  if (threadId && q.isLoading && !isNewInSession) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Shimmer>Loading conversation…</Shimmer>
      </div>
    );
  }

  const initialMessages: UIMessage[] =
    threadId && q.data?.found ? (JSON.parse(q.data.messagesJson) as UIMessage[]) : [];

  // When a thread was just created during this active chat session, preserve the session key so it doesn't unmount
  const sessionKey =
    isNewInSession || !threadId ? `chat-session-${sessionCounter}` : `thread-${threadId}`;

  return (
    <WorkspaceChatSession
      key={sessionKey}
      threadId={threadId}
      initialMessages={initialMessages}
      onThreadCreated={handleThreadCreated}
    />
  );
}

interface WorkspaceChatSessionProps {
  threadId: string | null;
  initialMessages: UIMessage[];
  onThreadCreated: (id: string) => void;
}

function WorkspaceChatSession({
  threadId,
  initialMessages,
  onThreadCreated,
}: WorkspaceChatSessionProps) {
  const { state, refresh } = useStore();
  const me = memberById(state, state.meId);
  const qc = useQueryClient();
  const create = useServerFn(createThread);
  const [input, setInput] = useState("");
  const [ctx, setCtx] = useState("workspace");
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "up" | "down">>({});

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleFeedback = (id: string, type: "up" | "down") => {
    setFeedbackMap((prev) => {
      const next = { ...prev };
      if (next[id] === type) {
        delete next[id];
      } else {
        next[id] = type;
      }
      return next;
    });
    toast.success(type === "up" ? "Thanks for your feedback!" : "Feedback recorded.");
  };

  const activeThreadIdRef = useRef(threadId);
  activeThreadIdRef.current = threadId;

  const [errorDismissed, setErrorDismissed] = useState(false);

  // Auto-dismiss lingering previous errors whenever user updates their AI config
  useEffect(() => {
    const handleConfigChange = () => {
      setErrorDismissed(true);
    };
    window.addEventListener("nexus-ai-config-changed", handleConfigChange);
    return () => window.removeEventListener("nexus-ai-config-changed", handleConfigChange);
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const headers: Record<string, string> = {};
          if (data.session) headers["Authorization"] = `Bearer ${data.session.access_token}`;
          const userCfg = getUserAiConfig();
          if (userCfg?.apiKey) {
            headers["x-user-ai-key"] = userCfg.apiKey;
            headers["x-user-ai-model"] = userCfg.model;
            headers["x-user-ai-provider"] = userCfg.provider;
          }
          return headers;
        },
        body: () => {
          const userCfg = getUserAiConfig();
          return {
            threadId: activeThreadIdRef.current,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            projectId: ctxRef.current === "workspace" ? null : ctxRef.current,
            ...(userCfg?.apiKey
              ? {
                  userApiKey: userCfg.apiKey,
                  userModel: userCfg.model,
                  userProvider: userCfg.provider,
                }
              : {}),
          };
        },
      }),
    [],
  );

  const {
    isListening,
    selectedLanguage,
    setSelectedLanguage,
    toggleListening,
    stopListening,
    resetTranscript,
  } = useSpeechToText({
    onTranscript: (spoken) => setInput(spoken),
  });

  const {
    isSpeaking,
    currentSpeakingId,
    autoPlay,
    toggleAutoPlay,
    speak,
    stop: stopSpeech,
  } = useTextToSpeech();

  const [chatSessionId] = useState(
    () =>
      threadId ||
      `session-${
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36)
      }`,
  );

  const { messages, sendMessage, status, stop, error, setMessages, regenerate } = useChat({
    id: chatSessionId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Nexus AI couldn’t answer."),
    onFinish: ({ message }) => {
      void refresh();
      void qc.invalidateQueries({ queryKey: ["ai-threads"] });
      textareaRef.current?.focus();
      if (autoPlay && message) {
        const text = message.parts
          .filter((p: { type: string; text?: string }) => p.type === "text" && Boolean(p.text))
          .map((p: { type: string; text?: string }) => p.text || "")
          .join(" ");
        if (text) speak(text, message.id, selectedLanguage);
      }
    },
  });

  // Sync loaded initialMessages into useChat if received after mount
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  const busy = status === "submitted" || status === "streaming";

  const handleSend = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || busy) return;
    setErrorDismissed(false);

    const userCfg = getUserAiConfig();
    if (!userCfg?.apiKey?.trim()) {
      toast.error("Nexus AI is not configured. Please configure your API key first.");
      openAiConfigDialog();
      return;
    }

    stopListening();
    resetTranscript();
    setInput("");
    recordAiRequest();

    // If starting from clean / empty route, ensure thread exists
    if (!activeThreadIdRef.current) {
      try {
        const newThread = await create();
        activeThreadIdRef.current = newThread.id;
        onThreadCreated(newThread.id);
      } catch (err) {
        toast.error(`Couldn't initialize thread: ${(err as Error).message}`);
        return;
      }
    }

    void sendMessage({ text });
  };

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, busy]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend(input);
    }
  };

  // Group consecutive assistant messages belonging to the same turn into a single unified response card
  const groupedMessages = useMemo(() => {
    const res: Array<{
      id: string;
      role: "user" | "assistant";
      parts: UIMessage["parts"];
    }> = [];

    for (const m of messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      const prev = res[res.length - 1];
      if (prev && prev.role === "assistant" && m.role === "assistant") {
        prev.parts = [...prev.parts, ...m.parts];
      } else {
        res.push({
          id: m.id,
          role: m.role,
          parts: [...m.parts],
        });
      }
    }
    return res;
  }, [messages]);

  const lastMessage = groupedMessages[groupedMessages.length - 1];
  const lastIsAssistant = lastMessage?.role === "assistant";
  const hasMessages = messages.length > 0;
  const currentLang =
    SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === selectedLanguage) ||
    SUPPORTED_VOICE_LANGUAGES[0]!;

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {!hasMessages ? (
        /* ==================================================================
           INITIAL EMPTY STATE (MATCHING COWORK BY SARVAM REFERENCE)
           ================================================================== */
        <div className="flex-1 flex flex-col justify-center items-center px-4 max-w-3xl mx-auto w-full -mt-6 sm:-mt-10">
          {/* Large elegant serif headline */}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-normal text-[#111111] tracking-tight text-center mb-8 select-none">
            Where should we begin?
          </h1>

          {/* Wide rounded prompt composer */}
          <div className="w-full rounded-3xl border border-[#EAEAEA] bg-white shadow-[0_2px_14px_rgba(0,0,0,0.03)] hover:border-[#D0D0D0] focus-within:border-[#111111] focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all p-3.5 sm:p-4.5">
            {/* Prompt input textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your projects, tasks, or team..."
              rows={2}
              className="w-full bg-transparent resize-none border-0 p-0 text-base text-[#111111] placeholder:text-[#999999] focus:outline-none focus:ring-0 min-h-[58px] max-h-40 leading-relaxed"
            />

            {/* Bottom controls bar: limit circle & workspace drawer at bottom-left, mic & circular send at bottom-right */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[#F5F5F5] mt-1">
              <div className="flex items-center gap-2">
                <AiLimitCircle />
                <Select value={ctx} onValueChange={setCtx}>
                  <SelectTrigger className="h-6 rounded-md bg-[#F4F4F5] hover:bg-[#EBEBEF] text-[#444444] hover:text-[#111111] text-[11px] font-medium px-2.5 py-0 border-0 gap-1 shadow-none transition-colors cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#EAEAEA] text-xs shadow-md">
                    <SelectItem value="workspace">Entire workspace</SelectItem>
                    {state.projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Spoken language selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="p-2 text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0] rounded-full transition-colors"
                      title={`Spoken Language: ${currentLang.name}`}
                    >
                      <Languages className="size-4 stroke-[1.8]" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-40 text-xs bg-white border-[#EAEAEA]"
                  >
                    <DropdownMenuLabel className="text-[10px] text-[#777777]">
                      Spoken Language
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => setSelectedLanguage(lang.code)}
                        className={cn(
                          "flex items-center justify-between text-xs cursor-pointer",
                          selectedLanguage === lang.code && "font-semibold text-emerald-700",
                        )}
                      >
                        <span>{lang.name}</span>
                        {selectedLanguage === lang.code && <Check className="size-3" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Microphone Voice button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "p-2 rounded-full transition-all cursor-pointer",
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]",
                  )}
                  title={isListening ? "Listening... click to stop" : "Voice dictation"}
                >
                  {isListening ? (
                    <MicOff className="size-4" />
                  ) : (
                    <Mic className="size-4 stroke-[1.8]" />
                  )}
                </button>

                {/* Circular Send Button */}
                <button
                  type="button"
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || busy}
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
                    input.trim()
                      ? "bg-[#111111] text-white hover:bg-black scale-100 shadow-xs"
                      : "bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed",
                  )}
                  title="Send message (Enter)"
                >
                  <ArrowUp className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>

          {/* Subtle AI accuracy disclaimer below composer */}
          <p className="text-center text-xs text-[#777777] mt-3 select-none">
            Nexus AI can make mistakes. Please verify important workspace actions.
          </p>

          {/* Three equally sized suggestion cards in one horizontal row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full mt-6">
            {SUGGESTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSend(item.prompt)}
                className="group rounded-xl border border-[#EAEAEA] bg-white p-3.5 text-left hover:border-[#111111] hover:bg-[#FAFAFA] transition-all cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#111111] group-hover:text-black">
                      {item.title}
                    </span>
                    <ArrowUpRight className="size-3.5 text-[#999999] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-[#777777] leading-relaxed">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ==================================================================
           ACTIVE CONVERSATION STATE
           ================================================================== */
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Scrollable messages container */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth">
            <div className="max-w-3xl mx-auto space-y-7">
              {groupedMessages.map((m, idx) => {
                const isLast = idx === groupedMessages.length - 1;

                if (m.role === "user") {
                  const userText = m.parts
                    .filter((p): p is TextUIPart => p.type === "text" && Boolean(p.text))
                    .map((p) => p.text || "")
                    .join("\n");

                  return (
                    <div
                      key={m.id}
                      className="group/user flex items-start justify-end gap-2.5 w-full"
                    >
                      <div className="relative flex flex-col items-end max-w-[85%] sm:max-w-[78%]">
                        <div className="rounded-2xl rounded-tr-xs bg-[#111111] text-white px-4.5 py-3 text-sm leading-relaxed shadow-xs font-normal selection:bg-white/20">
                          {m.parts.map((p, i) =>
                            p.type === "text" ? (
                              <span key={i} className="whitespace-pre-wrap">
                                {p.text}
                              </span>
                            ) : null,
                          )}
                        </div>
                        <div className="opacity-0 group-hover/user:opacity-100 transition-opacity mt-1 flex items-center gap-1.5 text-[11px] text-[#888888] px-1">
                          <button
                            type="button"
                            onClick={() => handleCopy(userText, m.id)}
                            className="hover:text-[#111111] p-1 rounded transition-colors flex items-center gap-1 cursor-pointer"
                            title="Copy prompt"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="size-3 text-emerald-600" />
                                <span className="text-[10px] text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="size-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <MemberAvatar
                        member={me}
                        size="sm"
                        className="mt-0.5 ring-1 ring-black/5 shadow-2xs shrink-0"
                      />
                    </div>
                  );
                }

                const fullText = m.parts
                  .filter((p): p is TextUIPart => p.type === "text" && Boolean(p.text))
                  .map((p) => p.text || "")
                  .join("\n\n");

                return (
                  <div
                    key={m.id}
                    className="group/assistant w-full space-y-2.5 animate-in fade-in duration-200"
                  >
                    {/* Assistant Header: Always single per prompt turn */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white flex items-center justify-center shadow-xs ring-1 ring-black/5">
                          <Sparkles
                            className={cn(
                              "size-3.5 text-emerald-400",
                              isLast && busy && "animate-spin",
                            )}
                            style={isLast && busy ? { animationDuration: "3s" } : undefined}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#111111] tracking-tight">
                            Nexus AI
                          </span>
                          <span className="text-[10px] text-[#666666] font-medium bg-[#F4F4F5] px-2 py-0.5 rounded-full border border-[#EAEAEA]">
                            Workspace Assistant
                          </span>
                          {isLast && busy && (
                            <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium ml-1">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Thinking…
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content Body: All parts unified in single response card */}
                    <div className="pl-9 space-y-3">
                      {m.parts.map((p, i) => {
                        if (p.type === "text") {
                          return (
                            <div
                              key={i}
                              className="text-sm text-[#1A1A1A] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-2.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-[#111111] [&_code]:rounded-md [&_code]:bg-[#F3F4F6] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_pre]:my-3.5 [&_pre]:rounded-xl [&_pre]:bg-[#18181B] [&_pre]:p-4 [&_pre]:text-white [&_table]:my-3.5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[#E5E7EB] [&_th]:bg-[#F9FAFB] [&_th]:px-3.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-[#E5E7EB] [&_td]:px-3.5 [&_td]:py-2 [&_td]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-3.5 [&_blockquote]:italic [&_blockquote]:text-[#666666]"
                            >
                              <MessageResponse>{p.text}</MessageResponse>
                            </div>
                          );
                        }
                        if (p.type === "reasoning" && p.text.trim()) {
                          return <ThinkingBlock key={i} text={p.text} />;
                        }
                        if (isToolUIPart(p)) {
                          return <ToolPart key={i} part={p} />;
                        }
                        return null;
                      })}

                      {/* Inline Analyzing indicator within the active response card */}
                      {isLast && busy && (
                        <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3.5 py-2 text-xs text-[#666666] flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] animate-in fade-in duration-200">
                          <div className="flex space-x-1">
                            <div
                              className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                          <span className="text-[12px] text-[#555555]">
                            Analyzing workspace data & drafting response…
                          </span>
                        </div>
                      )}

                      {/* Interactive Modern Action Toolbar: Only shown once response finishes generating */}
                      {(!busy || !isLast) && (
                        <div className="pt-2 flex items-center justify-between border-t border-[#F5F5F5] mt-2">
                          <div className="flex items-center gap-1">
                            {/* Copy Button */}
                            {fullText && (
                              <button
                                type="button"
                                onClick={() => handleCopy(fullText, m.id)}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[#666666] hover:bg-[#F4F4F5] hover:text-[#111111] transition-colors cursor-pointer"
                                title="Copy response"
                              >
                                {copiedId === m.id ? (
                                  <>
                                    <Check className="size-3.5 text-emerald-600" />
                                    <span className="text-[11px] font-medium text-emerald-600">
                                      Copied
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3.5" />
                                    <span className="text-[11px]">Copy</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Listen Button */}
                            {fullText && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (currentSpeakingId === m.id) {
                                    stopSpeech();
                                  } else {
                                    speak(fullText, m.id, selectedLanguage);
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
                                  currentSpeakingId === m.id
                                    ? "bg-emerald-50 text-emerald-700 font-medium"
                                    : "text-[#666666] hover:bg-[#F4F4F5] hover:text-[#111111]",
                                )}
                                title={
                                  currentSpeakingId === m.id
                                    ? "Stop speaking"
                                    : "Listen to response"
                                }
                              >
                                {currentSpeakingId === m.id ? (
                                  <>
                                    <Volume2 className="size-3.5 animate-pulse text-emerald-600" />
                                    <span className="text-[11px]">Speaking…</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="size-3.5" />
                                    <span className="text-[11px]">Listen</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Thumbs Up Button */}
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, "up")}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors cursor-pointer",
                                feedbackMap[m.id] === "up"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "text-[#888888] hover:bg-[#F4F4F5] hover:text-[#111111]",
                              )}
                              title="Helpful"
                            >
                              <ThumbsUp
                                className={cn(
                                  "size-3.5",
                                  feedbackMap[m.id] === "up" && "fill-emerald-600",
                                )}
                              />
                            </button>

                            {/* Thumbs Down Button */}
                            <button
                              type="button"
                              onClick={() => handleFeedback(m.id, "down")}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors cursor-pointer",
                                feedbackMap[m.id] === "down"
                                  ? "bg-amber-50 text-amber-600"
                                  : "text-[#888888] hover:bg-[#F4F4F5] hover:text-[#111111]",
                              )}
                              title="Not helpful"
                            >
                              <ThumbsDown
                                className={cn(
                                  "size-3.5",
                                  feedbackMap[m.id] === "down" && "fill-amber-600",
                                )}
                              />
                            </button>

                            {/* Regenerate Button on last message */}
                            {isLast && !busy && (
                              <button
                                type="button"
                                onClick={() => {
                                  setErrorDismissed(false);
                                  void regenerate();
                                }}
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[#666666] hover:bg-[#F4F4F5] hover:text-[#111111] transition-colors cursor-pointer ml-1"
                                title="Regenerate answer"
                              >
                                <RotateCcw className="size-3" />
                                <span className="text-[11px]">Retry</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Only show standalone thinking indicator before any assistant parts have arrived */}
              {busy && !lastIsAssistant && (
                <div className="flex items-start gap-2.5 pl-0 py-2 animate-in fade-in duration-300">
                  <div className="size-7 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] text-white flex items-center justify-center shadow-xs">
                    <Sparkles
                      className="size-3.5 text-emerald-400 animate-spin"
                      style={{ animationDuration: "3s" }}
                    />
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#111111]">Nexus AI</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Thinking…
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3.5 py-2 text-xs text-[#666666] flex items-center gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="flex space-x-1">
                        <div
                          className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="size-1.5 rounded-full bg-emerald-500 animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                      <span className="text-[12px] text-[#555555]">
                        Analyzing workspace data & drafting response…
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && !busy && !errorDismissed && (
                <div className="p-3.5 rounded-xl border border-red-200 bg-red-50/70 text-xs text-red-600 max-w-3xl mx-auto shadow-2xs flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex-1 leading-relaxed">{error.message}</div>
                  <button
                    type="button"
                    onClick={() => setErrorDismissed(true)}
                    className="text-red-400 hover:text-red-700 p-0.5 rounded cursor-pointer transition-colors shrink-0"
                    title="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Pinned Bottom Composer in Active Conversation */}
          <div className="px-4 pb-2 pt-0 bg-transparent shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="w-full rounded-xl sm:rounded-2xl border border-[#E5E5E5] bg-transparent hover:border-[#CCCCCC] focus-within:border-[#111111] transition-all px-3.5 py-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow up question or assign tasks..."
                  rows={1}
                  className="w-full bg-transparent resize-none border-0 p-0 text-sm text-[#111111] placeholder:text-[#999999] focus:outline-none focus:ring-0 min-h-[28px] max-h-32 leading-relaxed py-0.5"
                />

                <div className="flex items-center justify-between pt-1.5 border-t border-[#EAEAEA]/50 mt-1">
                  <div className="flex items-center gap-1.5">
                    <AiLimitCircle />
                    <Select value={ctx} onValueChange={setCtx}>
                      <SelectTrigger className="h-6 rounded-md bg-[#F4F4F5] hover:bg-[#EBEBEF] text-[#444444] hover:text-[#111111] text-[11px] font-medium px-2 py-0 border-0 gap-1 shadow-none transition-colors cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#EAEAEA] text-xs shadow-md">
                        <SelectItem value="workspace">Entire workspace</SelectItem>
                        {state.projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={cn(
                        "p-1 rounded-full transition-all cursor-pointer",
                        isListening
                          ? "bg-red-500 text-white animate-pulse"
                          : "text-[#777777] hover:text-[#111111] hover:bg-[#F0F0F0]/70",
                      )}
                      title={isListening ? "Listening... click to stop" : "Voice input"}
                    >
                      {isListening ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSend(input)}
                      disabled={!input.trim() || busy}
                      className={cn(
                        "size-6.5 rounded-full flex items-center justify-center transition-all cursor-pointer",
                        input.trim()
                          ? "bg-[#111111] text-white hover:bg-black scale-100 shadow-2xs"
                          : "bg-[#F0F0F0] text-[#AAAAAA] cursor-not-allowed",
                      )}
                      title="Send message (Enter)"
                    >
                      <ArrowUp className="size-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-center text-[10px] text-[#888888] mt-1.5 select-none">
                Nexus AI can make mistakes. Please verify important workspace actions.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Reasoning / Thinking Process Component
// ============================================================================
function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text || !text.trim()) return null;

  return (
    <div className="my-2.5 rounded-xl border border-[#EAEAEA] bg-[#FBFBFB] overflow-hidden text-xs transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-[#F3F4F6] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <Brain className="size-3.5 text-purple-600 animate-pulse" />
          <span className="font-semibold text-xs text-[#222222]">Reasoning Process</span>
          <span className="text-[10px] text-[#777777] font-mono bg-white px-2 py-0.5 rounded-full border border-[#EAEAEA]">
            {open ? "Hide" : "View steps"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 text-[#888888] transition-transform duration-200",
            open && "rotate-180 text-[#222222]",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-[#EAEAEA] bg-white p-3.5 text-xs text-[#555555] leading-relaxed whitespace-pre-wrap font-mono max-h-72 overflow-y-auto">
          {text}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tool Rendering (Task Cards, Plans, Bulk Changes)
// ============================================================================
interface ToolOut {
  saved?: boolean;
  task?: unknown;
  error?: string;
  proposalId?: string;
  changes?: unknown;
  plan?: unknown;
  tasks?: { id: string }[];
}
type AnyToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

function ToolPart({ part }: { part: AnyToolPart }) {
  const name = getToolName(part);
  const out =
    part.state === "output-available" &&
    part.output &&
    typeof part.output === "object" &&
    !Array.isArray(part.output)
      ? (part.output as ToolOut)
      : null;

  let card: React.ReactNode = null;
  if (out) {
    if ((name === "create_task" || name === "update_task") && out.saved) {
      card = <SavedTaskCard task={out.task as never} />;
    } else if ((name === "create_task" || name === "update_task") && out.error) {
      card = (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          Not saved: {String(out.error)}
        </p>
      );
    } else if (name === "propose_bulk_changes" && out.proposalId) {
      card = <BulkChangesCard proposalId={String(out.proposalId)} changes={out.changes as never} />;
    } else if (name === "propose_project_plan" && out.proposalId) {
      card = <PlanCard proposalId={String(out.proposalId)} plan={out.plan as never} />;
    } else if (name === "search_tasks" && Array.isArray(out.tasks)) {
      card = <TaskRows ids={(out.tasks as { id: string }[]).map((t) => t.id)} />;
    }
  }
  if (name === "list_projects" && part.state === "output-available" && Array.isArray(part.output)) {
    card = <ProjectsMini items={part.output as never} />;
  }

  return (
    <div className="space-y-2 my-2">
      <Tool defaultOpen={false} className="border-[#EAEAEA] bg-white rounded-xl shadow-2xs">
        <ToolHeader
          type={part.type as never}
          state={part.state}
          title={TOOL_LABEL[name] ?? name}
          toolName={name as never}
        />
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput
            output={part.state === "output-available" ? part.output : undefined}
            errorText={part.state === "output-error" ? part.errorText : undefined}
          />
        </ToolContent>
      </Tool>
      {card}
    </div>
  );
}
