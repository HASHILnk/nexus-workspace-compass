// Nexus AI chat agent: grounded workspace Q&A plus permission-checked actions.
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod/v4";
import type { Database, Json } from "@/integrations/supabase/types";
import { toMember, toProject, toTask } from "@/lib/db-map";
import { daysUntil, isOverdue, projectStats } from "@/lib/selectors";
import { canManage, ROLE_LABEL } from "@/lib/permissions";
import {
  createTask,
  proposeChanges,
  proposePlan,
  resolveContext,
  updateTask,
  type OpsContext,
} from "./workspace-ops";

const MODEL = "openai/gpt-6-astra";
const json = (status: number, message: string) => Response.json({ error: message }, { status });

// Adapts Gemini's OpenAI-compatible SSE stream to include tool_call.index required by @ai-sdk/openai
function createGeminiFetch() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await fetch(input, init);
    if (!response.body) return response;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const stream = new ReadableStream({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.length > 0) {
              controller.enqueue(encoder.encode(buffer));
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let transformedChunk = "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line.trim() !== "data: [DONE]") {
              try {
                const json = JSON.parse(line.slice(6));
                if (json.choices && Array.isArray(json.choices)) {
                  for (const choice of json.choices) {
                    if (choice.delta?.tool_calls && Array.isArray(choice.delta.tool_calls)) {
                      choice.delta.tool_calls.forEach(
                        (tc: Record<string, unknown>, idx: number) => {
                          if (tc["index"] === undefined) {
                            tc["index"] = idx;
                          }
                        },
                      );
                    }
                  }
                }
                transformedChunk += "data: " + JSON.stringify(json) + "\n";
              } catch {
                transformedChunk += line + "\n";
              }
            } else {
              transformedChunk += line + "\n";
            }
          }

          if (transformedChunk.length > 0) {
            controller.enqueue(encoder.encode(transformedChunk));
            return;
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

export function userClient(token: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function loadWorkspace(ctx: OpsContext) {
  const [m, p, t, r] = await Promise.all([
    ctx.sb.from("members").select("*"),
    ctx.sb.from("projects").select("*"),
    ctx.sb.from("tasks").select("*"),
    ctx.sb.from("user_roles").select("user_id, role"),
  ]);
  const err = [m, p, t, r].find((x) => x.error)?.error;
  if (err) throw new Error(err.message);
  const roles = new Map((r.data ?? []).map((x) => [x.user_id, x.role]));
  return {
    members: (m.data ?? []).map((x) => ({
      ...toMember(x),
      appRole: x.user_id ? (roles.get(x.user_id) ?? null) : null,
    })),
    projects: (p.data ?? []).map(toProject),
    tasks: (t.data ?? []).map(toTask),
  };
}

const status = z.enum(["backlog", "todo", "in_progress", "in_review", "done"]);
const priority = z.enum(["low", "medium", "high", "urgent"]);

function buildTools(ctx: OpsContext) {
  const brief = (w: Awaited<ReturnType<typeof loadWorkspace>>, tk: ReturnType<typeof toTask>) => ({
    id: tk.id,
    title: tk.title,
    project: w.projects.find((p) => p.id === tk.projectId)?.name ?? tk.projectId,
    projectId: tk.projectId,
    assignee: w.members.find((m) => m.id === tk.assigneeId)?.name ?? null,
    assigneeId: tk.assigneeId,
    status: tk.status,
    priority: tk.priority,
    dueDate: tk.dueDate,
    overdue: isOverdue(tk),
    daysUntilDue: daysUntil(tk.dueDate),
  });

  return {
    get_team_workload: tool({
      description:
        "Current workload of every team member, computed from live task assignments: open/active task counts, overdue, due in 7 days, and their self-set availability status. Use for 'who is free', 'who has nothing assigned', capacity and reminders.",
      inputSchema: z.object({}),
      execute: async () => {
        const w = await loadWorkspace(ctx);
        return {
          note: "availabilityStatus is the status each person set themselves; there is no calendar or working-hours data. 'Free' can only be inferred from assignments.",
          members: w.members.map((m) => {
            const mine = w.tasks.filter((x) => x.assigneeId === m.id);
            const open = mine.filter((x) => x.status !== "done");
            const active = open.filter(
              (x) => x.status === "in_progress" || x.status === "in_review",
            );
            return {
              id: m.id,
              name: m.name,
              jobTitle: m.role,
              availabilityStatus: m.availability,
              hasAccount: !!m.userId,
              openTasks: open.length,
              activeTasks: active.length,
              overdue: open.filter(isOverdue).length,
              dueNext7Days: open.filter((x) => {
                const n = daysUntil(x.dueDate);
                return n >= 0 && n <= 7;
              }).length,
              completedTotal: mine.length - open.length,
              hasNothingAssigned: open.length === 0,
            };
          }),
        };
      },
    }),
    list_projects: tool({
      description:
        "All projects with live progress, task counts, overdue counts, computed health and days to deadline.",
      inputSchema: z.object({}),
      execute: async () => {
        const w = await loadWorkspace(ctx);
        return w.projects.map((p) => {
          const s = projectStats(p, w.tasks);
          return {
            id: p.id,
            name: p.name,
            status: p.status,
            health: s.health,
            progressPct: s.progress,
            done: s.done,
            total: s.total,
            overdue: s.overdue,
            deadline: p.deadline,
            daysToDeadline: daysUntil(p.deadline),
            owner: w.members.find((m) => m.id === p.ownerId)?.name ?? null,
            milestones: p.milestones,
          };
        });
      },
    }),
    search_tasks: tool({
      description:
        "Find tasks by any combination of filters. Pass null or omit filters you don't need. Returns up to 60 tasks.",
      inputSchema: z.object({
        text: z.string().nullish().describe("Words to match in the task title"),
        projectId: z.string().nullish(),
        assigneeId: z
          .string()
          .nullish()
          .describe("Member id; use 'unassigned' for tasks with no assignee"),
        status: status.nullish(),
        openOnly: z.boolean().nullish(),
        overdueOnly: z.boolean().nullish(),
        dueWithinDays: z.number().nullish(),
      }),
      execute: async (f) => {
        const w = await loadWorkspace(ctx);
        const words = (f.text ?? "")
          .toLowerCase()
          .split(/\s+/)
          .filter((x) => x.length > 2);
        const hits = w.tasks.filter(
          (x) =>
            (!f.projectId || x.projectId === f.projectId) &&
            (!f.assigneeId ||
              (f.assigneeId === "unassigned" ? !x.assigneeId : x.assigneeId === f.assigneeId)) &&
            (!f.status || x.status === f.status) &&
            (!f.openOnly || x.status !== "done") &&
            (!f.overdueOnly || isOverdue(x)) &&
            (f.dueWithinDays == null ||
              (x.status !== "done" &&
                daysUntil(x.dueDate) >= 0 &&
                daysUntil(x.dueDate) <= f.dueWithinDays)) &&
            (!words.length || words.some((wd) => x.title.toLowerCase().includes(wd))),
        );
        return { count: hits.length, tasks: hits.slice(0, 60).map((x) => brief(w, x)) };
      },
    }),
    get_recent_activity: tool({
      description: "Recent activity feed entries (who did what), optionally for one project.",
      inputSchema: z.object({ projectId: z.string().nullish() }),
      execute: async ({ projectId }) => {
        let q = ctx.sb
          .from("activity")
          .select("actor_id, text, project_id, created_at")
          .order("created_at", { ascending: false })
          .limit(30);
        if (projectId) q = q.eq("project_id", projectId);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return data;
      },
    }),
    create_task: tool({
      description:
        "Create ONE task and save it to the database, optionally assigned to a team member with a due date. Only call when project, title, assignee (or explicitly none) and due date are clear. Returns the saved record or an error.",
      inputSchema: z.object({
        title: z.string(),
        projectId: z.string(),
        assigneeId: z.string().nullish(),
        dueDate: z.string().nullish().describe("YYYY-MM-DD"),
        priority: priority.nullish(),
        description: z.string().nullish(),
        status: status.nullish(),
      }),
      execute: async (input) => {
        const r = await createTask(ctx, {
          title: input.title,
          projectId: input.projectId,
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ?? null,
          priority: input.priority ?? null,
          description: input.description ?? null,
          status: input.status ?? null,
        });
        return r.ok ? { saved: true, task: r.data } : { saved: false, error: r.error };
      },
    }),
    update_task: tool({
      description:
        "Change ONE existing task (status, assignee, due date, priority or title) and save it. Pass null for fields that should not change. For 2+ tasks use propose_bulk_changes instead.",
      inputSchema: z.object({
        taskId: z.string(),
        status: status.nullish(),
        assigneeId: z.string().nullish(),
        unassign: z.boolean().nullish(),
        dueDate: z.string().nullish().describe("YYYY-MM-DD"),
        priority: priority.nullish(),
        title: z.string().nullish(),
      }),
      execute: async (input) => {
        const r = await updateTask(ctx, {
          taskId: input.taskId,
          status: input.status ?? null,
          assigneeId: input.assigneeId ?? null,
          unassign: input.unassign ?? null,
          dueDate: input.dueDate ?? null,
          priority: input.priority ?? null,
          title: input.title ?? null,
        });
        return r.ok ? { saved: true, task: r.data } : { saved: false, error: r.error };
      },
    }),
    propose_bulk_changes: tool({
      description:
        "Propose changes to two or more tasks. Nothing is saved: the user sees a confirmation card and must approve. Use for any bulk or consequential change.",
      inputSchema: z.object({
        summary: z.string(),
        changes: z.array(
          z.object({
            taskId: z.string(),
            status: status.nullish(),
            assigneeId: z.string().nullish(),
            unassign: z.boolean().nullish(),
            dueDate: z.string().nullish(),
            priority: priority.nullish(),
            title: z.string().nullish(),
          }),
        ),
      }),
      execute: async ({ summary, changes }) => {
        const r = await proposeChanges(
          ctx,
          summary,
          changes.map((c) => ({
            taskId: c.taskId,
            status: c.status ?? null,
            assigneeId: c.assigneeId ?? null,
            unassign: c.unassign ?? null,
            dueDate: c.dueDate ?? null,
            priority: c.priority ?? null,
            title: c.title ?? null,
          })),
        );
        return r.ok
          ? { awaitingConfirmation: true, proposalId: r.proposalId, changes: r.changes }
          : { error: r.error };
      },
    }),
    propose_project_plan: tool({
      description:
        "Draft a new project plan (milestones, tasks, suggested owners, risks). Nothing is saved: the user can edit the plan in a card and confirm to create it.",
      inputSchema: z.object({
        name: z.string(),
        description: z.string(),
        weeks: z.number(),
        milestones: z.array(z.object({ title: z.string(), week: z.number() })),
        tasks: z.array(
          z.object({
            title: z.string(),
            priority,
            startWeek: z.number(),
            days: z.number(),
            assigneeId: z.string().nullish(),
            role: z.string().nullish(),
          }),
        ),
        risks: z.array(z.string()),
      }),
      execute: async (plan) => {
        const r = await proposePlan(ctx, {
          ...plan,
          tasks: plan.tasks.map((t) => ({
            ...t,
            assigneeId: t.assigneeId ?? null,
            role: t.role ?? "",
          })),
        });
        return r.ok
          ? { awaitingConfirmation: true, proposalId: r.proposalId, plan: r.plan }
          : { error: r.error };
      },
    }),
  };
}

function systemPrompt(
  ctx: OpsContext,
  w: Awaited<ReturnType<typeof loadWorkspace>>,
  tz: string,
  scopeProjectId: string | null,
) {
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now);
  const scope = scopeProjectId ? w.projects.find((p) => p.id === scopeProjectId) : null;
  return `You are Nexus AI, the assistant inside the NEXUS project-management workspace.

Today is ${weekday}, ${local} (user's time zone ${tz}). Resolve relative dates ("Friday", "next week", "end of month") against this date; "Friday" means the next upcoming Friday (today if today is Friday). Always state the resolved calendar date.

Signed-in user: ${ctx.meName} (member id ${ctx.meId || "none"}), workspace role: ${ctx.role ? ROLE_LABEL[ctx.role] : "none"}.
${canManage(ctx.role) ? "They may create, assign and reassign tasks for anyone and create projects." : "They are a regular member: they may only create or change tasks assigned to or reported by themselves, and cannot assign work to others or create projects. If they ask for that, explain it needs an admin or project manager — do not attempt it."}
${scope ? `The user scoped this conversation to project "${scope.name}" (${scope.id}); default to it.` : ""}

Team directory (id — name — job title — app role):
${w.members.map((m) => `- ${m.id} — ${m.name} — ${m.role} — ${m.appRole ? ROLE_LABEL[m.appRole] : m.userId ? "Member" : "no account"}`).join("\n")}

Projects (id — name):
${w.projects.map((p) => `- ${p.id} — ${p.name}`).join("\n")}

Rules:
- Ground every factual statement in tool results from this turn. Never invent tasks, assignments, dates, workloads or availability. If data isn't in the workspace (calendars, hours, PTO), say it is not available rather than guessing.
- Distinguish facts ("Priya has 3 open tasks") from inferences ("so she may have capacity").
- Interpret indirect requests: "Rahul, handle the API integration by Friday" means create a task "API integration" assigned to Rahul due Friday. "Whose bucket is empty?" means who has no open tasks.
- Resolve people by name against the directory. If a name matches nobody, or several people, or the project is unclear, ask a short clarifying question listing the options instead of acting. Never assign to someone not in the directory.
- If the project is not stated, infer it only when one project clearly fits (e.g. an existing task with that name); otherwise ask.
- Single clear changes: call create_task / update_task directly. Two or more task changes, or anything risky: use propose_bulk_changes and tell the user to confirm in the card. Project plans: use propose_project_plan.
- Only say something was saved when the tool returned saved: true. If it returned an error, tell the user plainly what failed and why.
- After a save, confirm with the task title, assignee, project and exact due date.
- For workload questions call get_team_workload and give useful reminders (e.g. "Arjun has no active tasks and may be available for new work").
- For summaries, risk flags and sprint reports use list_projects / search_tasks and cite numbers.
- Be concise. Use markdown lists and bold for key numbers. Refer to tasks by title, not id.`;
}

export async function handleChat(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(401, "Please sign in to use Nexus AI.");
  const sb = userClient(token);
  const { data: claims, error: authErr } = await sb.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (authErr || !userId) return json(401, "Your session has expired. Please sign in again.");

  let body: {
    messages?: UIMessage[];
    threadId?: string;
    timeZone?: string;
    projectId?: string | null;
    userApiKey?: string;
    userModel?: string;
    userProvider?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, "Invalid request.");
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const threadId = typeof body.threadId === "string" ? body.threadId : "";
  if (!messages.length || !threadId) return json(400, "Missing conversation.");

  const { data: thread } = await sb
    .from("ai_threads")
    .select("id, title")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return json(404, "Conversation not found.");

  const userKey = request.headers.get("x-user-ai-key") || body.userApiKey;
  const userModel = request.headers.get("x-user-ai-model") || body.userModel;
  const userProvider = request.headers.get("x-user-ai-provider") || body.userProvider;

  if (!userKey || !userKey.trim()) {
    return json(
      400,
      "Nexus AI is not configured. Please click 'Configure AI' in the top bar to set up your API key.",
    );
  }

  const apiKey = userKey.trim();
  const isOpenRouter = userProvider === "openrouter" || apiKey.startsWith("sk-or-");
  const isGeminiFormat = apiKey.startsWith("AQ.") || apiKey.startsWith("AIza");
  const isGemini =
    userProvider === "gemini" ||
    (!isOpenRouter && (isGeminiFormat || (!userProvider && !apiKey.startsWith("sk-"))));

  let selectedModel = userModel;
  if (isOpenRouter) {
    if (
      !selectedModel ||
      selectedModel.includes("llama-3.3-70b-instruct:free") ||
      selectedModel.includes("gemini-2.0-flash-exp:free") ||
      selectedModel.includes("deepseek-r1:free") ||
      selectedModel.includes("deepseek-chat:free") ||
      selectedModel.includes("qwen-2.5-72b-instruct:free") ||
      selectedModel.includes("mistral-small-24b-instruct-2501:free")
    ) {
      selectedModel = "openrouter/free";
    }
  } else if (isGemini) {
    if (!selectedModel) selectedModel = "gemini-2.5-flash";
  } else {
    if (!selectedModel) selectedModel = "gpt-4o";
  }

  const ctx = await resolveContext(sb, userId, threadId);
  let w: Awaited<ReturnType<typeof loadWorkspace>>;
  try {
    w = await loadWorkspace(ctx);
  } catch (e) {
    return json(500, `Couldn’t read the workspace: ${(e as Error).message}`);
  }
  let tz = "UTC";
  try {
    if (body.timeZone) {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timeZone });
      tz = body.timeZone;
    }
  } catch {
    /* keep UTC */
  }

  // Save the incoming user message before calling the model.
  const last = messages[messages.length - 1]!;
  if (last.role === "user") {
    const { error } = await sb
      .from("ai_messages")
      .upsert(
        { thread_id: threadId, user_id: userId, ui_id: last.id, message: last as unknown as Json },
        { onConflict: "thread_id,ui_id" },
      );
    if (error) return json(500, `Couldn’t save your message: ${error.message}`);
    if (thread.title === "New conversation") {
      const text = last.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join(" ")
        .trim();
      await sb
        .from("ai_threads")
        .update({
          title: text.slice(0, 60) || "New conversation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);
    }
  }

  // Replay history without earlier reasoning items (stateless gateway).
  const history = messages.map((m) =>
    m.role === "assistant" ? { ...m, parts: m.parts.filter((p) => p.type !== "reasoning") } : m,
  );

  let provider;
  let modelInstance;

  if (isOpenRouter) {
    provider = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      headers: {
        "HTTP-Referer": "https://nexus-workspace.app",
        "X-Title": "Nexus Workspace Compass",
      },
    });
    modelInstance = provider.chat(selectedModel);
  } else if (isGemini) {
    provider = createOpenAI({
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey,
      fetch: createGeminiFetch(),
    });
    modelInstance = provider.chat(selectedModel);
  } else {
    provider = createOpenAI({ apiKey });
    modelInstance = provider.chat(selectedModel);
  }

  const result = streamText({
    model: modelInstance,
    system: systemPrompt(ctx, w, tz, body.projectId ?? null),
    messages: await convertToModelMessages(history),
    tools: buildTools(ctx),
    stopWhen: stepCountIs(50),
    abortSignal: request.signal,
    maxRetries: 2,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    generateMessageId: () => crypto.randomUUID(),
    sendReasoning: true,
    onError: (e) => {
      const err = e as {
        statusCode?: number;
        message?: string;
        lastError?: { statusCode?: number; message?: string };
      };
      console.error("[nexus-ai] stream error", {
        provider: isOpenRouter ? "openrouter" : isGemini ? "gemini" : "openai",
        model: selectedModel,
        statusCode: err?.statusCode ?? err?.lastError?.statusCode,
        message: err?.message,
      });

      const msg = (err?.message || "").toLowerCase();
      const code = err?.statusCode ?? err?.lastError?.statusCode;
      const is429 =
        code === 429 ||
        msg.includes("429") ||
        msg.includes("too many requests") ||
        msg.includes("rate limit");
      const isAuthError =
        code === 401 ||
        code === 403 ||
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("unauthorized") ||
        msg.includes("invalid api key") ||
        msg.includes("user not found") ||
        msg.includes("access denied");

      if (
        code === 402 ||
        msg.includes("402") ||
        msg.includes("credits") ||
        msg.includes("payment")
      ) {
        if (isOpenRouter) {
          return "Your OpenRouter account requires credits for this model. Switch to 'OpenRouter Free Router' in AI configuration for 100% free usage.";
        }
        return "Nexus AI is out of credits. A workspace owner can add more in Settings → Plans & credits.";
      }

      if (isAuthError) {
        if (isOpenRouter) {
          return "Invalid OpenRouter API key. Please check your token in 'Configure AI' (OpenRouter keys start with 'sk-or-v1-').";
        }
        if (isGemini) {
          return "Invalid Google Gemini API key. Please check your key in 'Configure AI'.";
        }
        return "Access denied. Please verify your API key in 'Configure AI'.";
      }

      if (is429) {
        if (isOpenRouter) {
          return "OpenRouter free model rate limit reached. Please wait 10-20 seconds or switch to another free model in AI configuration.";
        }
        if (isGemini) {
          if (!userKey) {
            return "The shared workspace Gemini key has hit Google's rate limit (429 Too Many Requests). Click 'Configure AI' at the top to connect your own free Gemini API key and chat without interruption.";
          }
          return "You have reached your Gemini API rate limit (429 Too Many Requests). Please wait a moment, or switch to Gemini 2.5 Flash in AI configuration.";
        }
        return "You have reached your API rate limit (429 Too Many Requests). Please wait a moment.";
      }

      if (
        code === 404 ||
        msg.includes("model not found") ||
        msg.includes("no longer available") ||
        msg.includes("not supported")
      ) {
        if (isOpenRouter) {
          return `The model '${selectedModel}' was not found or is currently offline on OpenRouter. Please select 'OpenRouter Free Router' in AI configuration.`;
        }
        if (isGemini) {
          return "This model is no longer available from Google Gemini. Please switch to Gemini 2.5 Flash in AI configuration.";
        }
        return `The model '${selectedModel}' was not found. Please check your AI configuration.`;
      }

      if (
        code === 503 ||
        code === 502 ||
        msg.includes("503") ||
        msg.includes("502") ||
        msg.includes("high demand") ||
        msg.includes("overloaded") ||
        msg.includes("unavailable") ||
        msg.includes("spikes in demand")
      ) {
        if (isOpenRouter) {
          return "OpenRouter upstream provider is experiencing high demand. Please try again shortly or switch models in AI configuration.";
        }
        if (isGemini) {
          return "Google Gemini is currently experiencing high demand & capacity limits for this model (503 Service Unavailable). Click the model badge at the top to switch to Gemini 2.5 Flash for instant 2-second responses.";
        }
        return "The AI service is temporarily unavailable (503). Please try again shortly.";
      }

      return err?.message
        ? `Nexus AI error: ${err.message}`
        : "Nexus AI hit an error answering that. Please try again.";
    },
    onFinish: async ({ responseMessage }) => {
      const { error } = await sb.from("ai_messages").upsert(
        {
          thread_id: threadId,
          user_id: userId,
          ui_id: responseMessage.id,
          message: responseMessage as unknown as Json,
        },
        { onConflict: "thread_id,ui_id" },
      );
      if (error) console.error("[nexus-ai] failed to save assistant message", error.message);
      await sb
        .from("ai_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
    },
  });
  return response;
}
