import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { Expand, History, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { memberById } from "@/lib/selectors";
import { ROLE_LABEL } from "@/lib/permissions";
import { createThread, deleteThread, getThreadMessages, listThreads } from "@/lib/ai.functions";
import { BulkChangesCard, PlanCard, ProjectsMini, SavedTaskCard, TaskRows } from "./ai-cards";
import { AiLimitBar } from "./ai-config-dialog";
import { getUserAiConfig, openAiConfigDialog, recordAiRequest } from "@/lib/ai/user-ai-config";
import { cn } from "@/lib/utils";
import mark from "@/assets/nexus-ai-mark.png";

const CHIPS = ["What should I focus on today?", "Who has nothing assigned right now?", "Find overdue tasks", "Identify project risks", "Generate a sprint report", "Create a project plan for launching our new mobile app in 6 weeks"];
const TOOL_LABEL: Record<string, string> = {
  get_team_workload: "Checked team workload", list_projects: "Read projects", search_tasks: "Searched tasks", get_recent_activity: "Read activity",
  create_task: "Create task", update_task: "Update task", propose_bulk_changes: "Proposed changes", propose_project_plan: "Drafted plan",
};
let handledPrompt = 0;

export function AiMark({ className }: { className?: string }) {
  return <img src={mark} alt="" width={28} height={28} className={cn("size-7 rounded-lg bg-card object-contain", className)} />;
}

/** Side panel / page shell. `routeThreadId` set = full-page thread route. */
export function AiPanel({ className, onClose, routeThreadId }: { className?: string; onClose?: () => void; routeThreadId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const remove = useServerFn(deleteThread);
  const threads = useQuery({ queryKey: ["ai-threads"], queryFn: () => list() });
  const [panelThread, setPanelThread] = useState<string | null>(null);
  const creating = useRef(false);
  const activeId = routeThreadId ?? panelThread;

  const open = (id: string) => (routeThreadId ? void navigate({ to: "/ai/$threadId", params: { threadId: id } }) : setPanelThread(id));
  const newThread = async () => {
    try { const t = await create(); await qc.invalidateQueries({ queryKey: ["ai-threads"] }); open(t.id); }
    catch (e) { toast.error(`Couldn’t start a conversation: ${(e as Error).message}`); }
  };

  // Panel mode: pick the latest thread once, or create the first one.
  useEffect(() => {
    if (routeThreadId || panelThread || !threads.data || creating.current) return;
    if (threads.data[0]) setPanelThread(threads.data[0].id);
    else { creating.current = true; void newThread().finally(() => (creating.current = false)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.data, routeThreadId, panelThread]);

  const title = threads.data?.find((t) => t.id === activeId)?.title ?? "New conversation";

  return (
    <aside className={cn("flex h-full flex-col bg-card", className)} aria-label="Nexus AI assistant">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <AiMark />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Nexus AI</p>
          <p className="truncate text-[11px] text-muted-foreground">{title}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" aria-label="New conversation" onClick={() => void newThread()}><Plus className="size-4" /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7" aria-label="Conversation history"><History className="size-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Conversations</DropdownMenuLabel>
            {(threads.data ?? []).map((t) => (
              <div key={t.id} className={cn("flex items-center rounded-sm", t.id === activeId && "bg-muted")}>
                <DropdownMenuItem className="min-w-0 flex-1" onClick={() => open(t.id)}><span className="truncate">{t.title}</span></DropdownMenuItem>
                <button aria-label={`Delete ${t.title}`} className="p-1.5 text-muted-foreground hover:text-destructive" onClick={async () => { await remove({ data: { id: t.id } }); await qc.invalidateQueries({ queryKey: ["ai-threads"] }); if (t.id === activeId) { setPanelThread(null); if (routeThreadId) void navigate({ to: "/ai" }); } }}><Trash2 className="size-3.5" /></button>
              </div>
            ))}
            {activeId && !routeThreadId && <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/ai/$threadId" params={{ threadId: activeId }}><Expand className="size-3.5" />Open full page</Link></DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
        {onClose && <Button variant="ghost" size="icon" className="size-7" aria-label="Close assistant" onClick={onClose}><X className="size-4" /></Button>}
      </header>
      <AiLimitBar />
      {activeId ? <ThreadLoader key={activeId} threadId={activeId} /> : <div className="flex-1 p-4"><Shimmer>Loading conversations…</Shimmer></div>}
    </aside>
  );
}

function ThreadLoader({ threadId }: { threadId: string }) {
  const get = useServerFn(getThreadMessages);
  const q = useQuery({ queryKey: ["ai-thread", threadId], queryFn: () => get({ data: { id: threadId } }), staleTime: Infinity });
  if (q.isLoading) return <div className="flex-1 p-4"><Shimmer>Loading conversation…</Shimmer></div>;
  if (q.error || !q.data?.found) return <div className="flex-1 p-4 text-sm text-muted-foreground">This conversation couldn’t be found.</div>;
  return <ChatWindow threadId={threadId} initial={JSON.parse(q.data.messagesJson) as UIMessage[]} />;
}

function ChatWindow({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const { state, ui, refresh } = useStore();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [ctx, setCtx] = useState("workspace");
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const ta = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({
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
        threadId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        projectId: ctxRef.current === "workspace" ? null : ctxRef.current,
        ...(userCfg?.apiKey ? {
          userApiKey: userCfg.apiKey,
          userModel: userCfg.model,
          userProvider: userCfg.provider,
        } : {}),
      };
    },
  }), [threadId]);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId, messages: initial, transport,
    onError: (e) => toast.error(e.message || "Nexus AI couldn’t answer."),
    onFinish: () => { void refresh(); void qc.invalidateQueries({ queryKey: ["ai-threads"] }); ta.current?.focus(); },
  });
  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const userCfg = getUserAiConfig();
    if (!userCfg?.apiKey?.trim()) {
      toast.error("Nexus AI is not configured. Please configure your API key first.");
      openAiConfigDialog();
      return;
    }
    recordAiRequest();
    void sendMessage({ text: t });
    setInput("");
  };

  useEffect(() => { ta.current?.focus(); }, []);
  useEffect(() => {
    if (ui.aiPrompt && ui.aiPrompt.n !== handledPrompt) { handledPrompt = ui.aiPrompt.n; send(ui.aiPrompt.text); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.aiPrompt]);

  const me = memberById(state, state.meId);
  const last = messages[messages.length - 1];
  const userCfg = getUserAiConfig();
  const isKeyConfigured = Boolean(userCfg?.apiKey?.trim());

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="gap-5 px-4 text-sm">
          {messages.length === 0 && (
            <div className="pt-2">
              <p className="text-base font-semibold">How can I help, {me?.name.split(" ")[0] ?? "there"}?</p>
              <p className="mt-1 text-xs text-muted-foreground">I answer from your live workspace data and can create or assign tasks for you{state.myRole ? ` (you’re signed in as ${ROLE_LABEL[state.myRole]})` : ""}. Bulk changes and new projects always wait for your confirmation.</p>
              {!isKeyConfigured && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  <span>Nexus AI is not configured. Connect your Gemini API key to start chatting.</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-amber-500/40" onClick={openAiConfigDialog}>Configure AI</Button>
                </div>
              )}
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "assistant" ? "w-full bg-transparent p-0" : undefined}>
                {m.parts.map((p, i) => {
                  if (p.type === "text") return m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i} className="whitespace-pre-wrap">{p.text}</span>;
                  if (p.type === "reasoning" && p.text.trim()) return <details key={i} className="text-xs text-muted-foreground"><summary className="cursor-pointer">Reasoning</summary><p className="mt-1 whitespace-pre-wrap">{p.text}</p></details>;
                  if (isToolUIPart(p)) return <ToolPart key={i} part={p} />;
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {busy && (last?.role === "user" || !last?.parts.some((p) => p.type === "text" && p.text)) && <Shimmer className="text-xs">Checking your workspace…</Shimmer>}
          {error && !busy && <p className="text-xs text-destructive">{error.message}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3">
        {messages.length === 0 && <div className="mb-2 flex flex-wrap gap-1.5">{CHIPS.map((c) => <button key={c} onClick={() => send(c)} className="rounded-full border bg-background px-2.5 py-1 text-xs hover:border-primary">{c.length > 40 ? "Create a project plan" : c}</button>)}</div>}
        <PromptInput onSubmit={(msg) => send(msg.text)}>
          <PromptInputTextarea ref={ta} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask, or say “Rahul, handle the API integration by Friday”…" aria-label="Message Nexus AI" className="min-h-12 text-sm" />
          <PromptInputFooter className="justify-between">
            <Select value={ctx} onValueChange={setCtx}>
              <SelectTrigger className="h-7 w-auto max-w-40 gap-1 border-0 bg-muted px-2 text-[11px] shadow-none" aria-label="Context"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="workspace">Entire workspace</SelectItem>{state.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}

interface ToolOut { saved?: boolean; task?: unknown; error?: string; proposalId?: string; changes?: unknown; plan?: unknown; tasks?: { id: string }[] }
type AnyToolPart = Extract<UIMessage["parts"][number], { toolCallId: string }>;

function ToolPart({ part }: { part: AnyToolPart }) {
  const name = getToolName(part);
  const out = part.state === "output-available" && part.output && typeof part.output === "object" && !Array.isArray(part.output) ? (part.output as ToolOut) : null;
  let card: React.ReactNode = null;
  if (out) {
    if ((name === "create_task" || name === "update_task") && out.saved) card = <SavedTaskCard task={out.task as never} />;
    else if ((name === "create_task" || name === "update_task") && out.error) card = <p className="rounded-lg bg-destructive-soft px-3 py-2 text-xs text-destructive">Not saved: {String(out.error)}</p>;
    else if (name === "propose_bulk_changes" && out.proposalId) card = <BulkChangesCard proposalId={String(out.proposalId)} changes={out.changes as never} />;
    else if (name === "propose_project_plan" && out.proposalId) card = <PlanCard proposalId={String(out.proposalId)} plan={out.plan as never} />;
    else if (name === "search_tasks" && Array.isArray(out.tasks)) card = <TaskRows ids={(out.tasks as { id: string }[]).map((t) => t.id)} />;
  }
  if (name === "list_projects" && part.state === "output-available" && Array.isArray(part.output)) card = <ProjectsMini items={part.output as never} />;
  return (
    <div className="space-y-2">
      <Tool defaultOpen={false} className="mb-0">
        <ToolHeader type={part.type as never} state={part.state} title={TOOL_LABEL[name] ?? name} toolName={name as never} />
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput output={part.state === "output-available" ? part.output : undefined} errorText={part.state === "output-error" ? part.errorText : undefined} />
        </ToolContent>
      </Tool>
      {card}
    </div>
  );
}
