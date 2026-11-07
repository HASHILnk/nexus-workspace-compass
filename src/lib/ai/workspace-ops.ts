// Workspace actions performed by Nexus AI on behalf of the signed-in user.
// Every function runs with the user's own database client, so row-level security
// enforces their permissions; each result is read back from the database before
// it is reported, and every attempt is written to the AI audit trail.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, formatISO } from "date-fns";
import type { Database, Json } from "@/integrations/supabase/types";
import { toTask, type Role } from "@/lib/db-map";
import { canAssignTo, canEditTask, canManage } from "@/lib/permissions";
import type { Priority, Status, Task } from "@/lib/types";

export interface OpsContext {
  sb: SupabaseClient<Database>;
  userId: string;
  meId: string;
  meName: string;
  role: Role | null;
  threadId: string | null;
}

export type OpResult<T> =
  | { ok: true; data: T; auditId: string | null }
  | { ok: false; error: string; auditId: string | null };

const rid = (p: string) => `${p}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
const iso = (d: Date) => formatISO(d, { representation: "date" });

export async function resolveContext(
  sb: SupabaseClient<Database>,
  userId: string,
  threadId: string | null,
): Promise<OpsContext> {
  const [{ data: me }, { data: role }] = await Promise.all([
    sb.from("members").select("id, name").eq("user_id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    sb,
    userId,
    meId: me?.id ?? "",
    meName: me?.name ?? "Unknown user",
    role: role?.role ?? null,
    threadId,
  };
}

async function audit(
  ctx: OpsContext,
  tool: string,
  status: "executed" | "failed" | "pending",
  summary: string,
  input: unknown,
  result: unknown,
) {
  const { data, error } = await ctx.sb
    .from("ai_actions")
    .insert({
      user_id: ctx.userId,
      member_id: ctx.meId || null,
      thread_id: ctx.threadId,
      tool,
      status,
      summary,
      input: input as Json,
      result: (result ?? null) as Json,
    })
    .select("id")
    .single();
  if (error) console.error("[nexus-ai] audit write failed", error.message);
  return data?.id ?? null;
}

async function logAi(ctx: OpsContext, text: string, projectId: string | null) {
  const { error } = await ctx.sb.from("activity").insert({
    actor_id: "ai",
    on_behalf_of: ctx.meId,
    text: `${text} (for ${ctx.meName})`,
    project_id: projectId,
  });
  if (error) console.error("[nexus-ai] activity write failed", error.message);
}

async function notify(
  ctx: OpsContext,
  recipientId: string,
  kind: string,
  text: string,
  projectId: string | null,
) {
  if (!recipientId || recipientId === ctx.meId) return;
  const { error } = await ctx.sb
    .from("notifications")
    .insert({ kind, text, recipient_id: recipientId, project_id: projectId });
  if (error) console.error("[nexus-ai] notification write failed", error.message);
}

async function memberName(ctx: OpsContext, id: string | null) {
  if (!id) return "nobody";
  const { data } = await ctx.sb.from("members").select("name").eq("id", id).maybeSingle();
  return data?.name ?? id;
}

export interface CreateTaskInput {
  title: string;
  projectId: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: Priority | null;
  description: string | null;
  status: Status | null;
}

export async function createTask(ctx: OpsContext, input: CreateTaskInput): Promise<OpResult<Task>> {
  const fail = async (error: string) => ({
    ok: false as const,
    error,
    auditId: await audit(ctx, "create_task", "failed", `Could not create “${input.title}”`, input, {
      error,
    }),
  });
  if (!ctx.meId) return fail("Your account isn’t linked to a team member yet.");
  if (!canAssignTo(ctx.role, ctx.meId, input.assigneeId))
    return fail("Only admins and project managers can assign tasks to other people.");
  const { data: project } = await ctx.sb
    .from("projects")
    .select("id, name")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return fail(`Project ${input.projectId} does not exist.`);
  if (input.assigneeId) {
    const { data: m } = await ctx.sb
      .from("members")
      .select("id")
      .eq("id", input.assigneeId)
      .maybeSingle();
    if (!m) return fail(`Team member ${input.assigneeId} does not exist.`);
  }
  const today = iso(new Date());
  const { data, error } = await ctx.sb
    .from("tasks")
    .insert({
      id: rid("t"),
      title: input.title.trim(),
      description: input.description ?? "",
      project_id: input.projectId,
      assignee_id: input.assigneeId,
      reporter_id: ctx.meId,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      start_date: input.dueDate && input.dueDate < today ? input.dueDate : today,
      due_date: input.dueDate ?? iso(addDays(new Date(), 7)),
      labels: ["ai"],
    })
    .select("*")
    .single();
  if (error || !data) return fail(error?.message ?? "The database did not confirm the new task.");
  const task = toTask(data);
  const who = await memberName(ctx, task.assigneeId);
  await logAi(
    ctx,
    `created “${task.title}”${task.assigneeId ? ` for ${who}` : ""}, due ${task.dueDate}`,
    task.projectId,
  );
  if (task.assigneeId)
    await notify(
      ctx,
      task.assigneeId,
      "assignment",
      `${ctx.meName} assigned you “${task.title}” (due ${task.dueDate}) via Nexus AI`,
      task.projectId,
    );
  return {
    ok: true,
    data: task,
    auditId: await audit(
      ctx,
      "create_task",
      "executed",
      `Created “${task.title}” → ${who}, due ${task.dueDate} in ${project.name}`,
      input,
      { taskId: task.id },
    ),
  };
}

export interface TaskChange {
  taskId: string;
  status: Status | null;
  assigneeId: string | null;
  dueDate: string | null;
  priority: Priority | null;
  title: string | null;
  unassign: boolean | null;
}

async function applyChange(
  ctx: OpsContext,
  c: TaskChange,
): Promise<{ ok: true; task: Task; summary: string } | { ok: false; error: string }> {
  const { data: row } = await ctx.sb.from("tasks").select("*").eq("id", c.taskId).maybeSingle();
  if (!row) return { ok: false, error: `Task ${c.taskId} does not exist.` };
  const before = toTask(row);
  if (!canEditTask(ctx.role, ctx.meId, before))
    return { ok: false, error: `You don’t have permission to change “${before.title}”.` };
  const nextAssignee = c.unassign ? null : (c.assigneeId ?? before.assigneeId);
  if (nextAssignee !== before.assigneeId && !canAssignTo(ctx.role, ctx.meId, nextAssignee))
    return {
      ok: false,
      error: "Only admins and project managers can reassign tasks to other people.",
    };
  const patch: Database["public"]["Tables"]["tasks"]["Update"] = {};
  const parts: string[] = [];
  if (c.status && c.status !== before.status) {
    patch.status = c.status;
    parts.push(`status → ${c.status}`);
  }
  if (nextAssignee !== before.assigneeId) {
    patch.assignee_id = nextAssignee;
    parts.push(`assignee → ${await memberName(ctx, nextAssignee)}`);
  }
  if (c.dueDate && c.dueDate !== before.dueDate) {
    patch.due_date = c.dueDate;
    parts.push(`due → ${c.dueDate}`);
  }
  if (c.priority && c.priority !== before.priority) {
    patch.priority = c.priority;
    parts.push(`priority → ${c.priority}`);
  }
  if (c.title && c.title !== before.title) {
    patch.title = c.title;
    parts.push(`renamed → “${c.title}”`);
  }
  if (!parts.length)
    return {
      ok: true,
      task: before,
      summary: `“${before.title}” already matched; nothing changed`,
    };
  const { data, error } = await ctx.sb
    .from("tasks")
    .update(patch)
    .eq("id", c.taskId)
    .select("*")
    .single();
  if (error || !data)
    return {
      ok: false,
      error:
        error?.message ?? "The database did not confirm the change (you may not have permission).",
    };
  const task = toTask(data);
  const summary = `updated “${task.title}”: ${parts.join(", ")}`;
  await logAi(ctx, summary, task.projectId);
  if (patch.assignee_id)
    await notify(
      ctx,
      patch.assignee_id,
      "assignment",
      `${ctx.meName} assigned you “${task.title}” via Nexus AI`,
      task.projectId,
    );
  return { ok: true, task, summary };
}

export async function updateTask(ctx: OpsContext, c: TaskChange): Promise<OpResult<Task>> {
  const r = await applyChange(ctx, c);
  if (!r.ok)
    return {
      ok: false,
      error: r.error,
      auditId: await audit(ctx, "update_task", "failed", `Could not update ${c.taskId}`, c, {
        error: r.error,
      }),
    };
  return {
    ok: true,
    data: r.task,
    auditId: await audit(ctx, "update_task", "executed", r.summary, c, { taskId: r.task.id }),
  };
}

/** Bulk changes are only recorded as a pending proposal; the user must confirm them. */
export async function proposeChanges(ctx: OpsContext, summary: string, changes: TaskChange[]) {
  const { data: rows } = await ctx.sb
    .from("tasks")
    .select("id, title")
    .in(
      "id",
      changes.map((c) => c.taskId),
    );
  const known = new Map((rows ?? []).map((r) => [r.id, r.title]));
  const missing = changes.filter((c) => !known.has(c.taskId)).map((c) => c.taskId);
  if (missing.length)
    return { ok: false as const, error: `These tasks don’t exist: ${missing.join(", ")}` };
  const id = await audit(ctx, "bulk_update", "pending", summary, { changes }, null);
  if (!id) return { ok: false as const, error: "Could not record the proposal." };
  return {
    ok: true as const,
    proposalId: id,
    changes: changes.map((c) => ({ ...c, title: known.get(c.taskId) ?? c.taskId })),
  };
}

export interface PlanInput {
  name: string;
  description: string;
  weeks: number;
  milestones: { title: string; week: number }[];
  tasks: {
    title: string;
    priority: Priority;
    startWeek: number;
    days: number;
    assigneeId: string | null;
    role: string;
  }[];
  risks: string[];
}

export async function proposePlan(ctx: OpsContext, plan: PlanInput) {
  const id = await audit(
    ctx,
    "project_plan",
    "pending",
    `Drafted plan “${plan.name}” (${plan.tasks.length} tasks)`,
    plan,
    null,
  );
  if (!id) return { ok: false as const, error: "Could not record the plan." };
  return { ok: true as const, proposalId: id, plan };
}

async function loadPending(ctx: OpsContext, id: string, tool: string) {
  const { data } = await ctx.sb
    .from("ai_actions")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!data) return { error: "Proposal not found." };
  if (data.tool !== tool) return { error: "Wrong proposal type." };
  if (data.status !== "pending") return { error: `This proposal was already ${data.status}.` };
  return { row: data };
}

const resolve = (
  ctx: OpsContext,
  id: string,
  status: "applied" | "rejected" | "failed",
  result: unknown,
) =>
  ctx.sb
    .from("ai_actions")
    .update({ status, result: result as Json, resolved_at: new Date().toISOString() })
    .eq("id", id);

export async function applyBulkProposal(ctx: OpsContext, id: string) {
  const p = await loadPending(ctx, id, "bulk_update");
  if ("error" in p) return { ok: false as const, error: p.error ?? "Unknown error" };
  const changes = (p.row.input as { changes?: TaskChange[] }).changes ?? [];
  const results = [];
  for (const c of changes) {
    const r = await applyChange(ctx, c);
    results.push(
      r.ok
        ? { taskId: c.taskId, ok: true, summary: r.summary }
        : { taskId: c.taskId, ok: false, error: r.error },
    );
  }
  const okCount = results.filter((r) => r.ok).length;
  await resolve(ctx, id, okCount ? "applied" : "failed", { results });
  return { ok: true as const, applied: okCount, failed: results.length - okCount, results };
}

export async function applyPlanProposal(ctx: OpsContext, id: string, plan: PlanInput) {
  if (!canManage(ctx.role))
    return { ok: false as const, error: "Only admins and project managers can create projects." };
  const p = await loadPending(ctx, id, "project_plan");
  if ("error" in p) return { ok: false as const, error: p.error ?? "Unknown error" };
  const now = new Date();
  const projectId = rid("p");
  const memberIds = Array.from(
    new Set([ctx.meId, ...plan.tasks.map((t) => t.assigneeId).filter((x): x is string => !!x)]),
  );
  const { error: pe } = await ctx.sb.from("projects").insert({
    id: projectId,
    name: plan.name.trim() || "New project",
    description: plan.description,
    owner_id: ctx.meId,
    member_ids: memberIds,
    status: "planning",
    priority: "high",
    start_date: iso(now),
    deadline: iso(addDays(now, plan.weeks * 7)),
    color: "primary",
    milestones: plan.milestones.map((m) => ({
      id: rid("m"),
      title: m.title,
      date: iso(addDays(now, m.week * 7)),
      done: false,
    })) as unknown as Json,
  });
  if (pe) {
    await resolve(ctx, id, "failed", { error: pe.message });
    return { ok: false as const, error: pe.message };
  }
  const rows = plan.tasks
    .filter((t) => t.title.trim())
    .map((t) => {
      const start = addDays(now, Math.max(0, t.startWeek - 1) * 7);
      return {
        id: rid("t"),
        title: t.title.trim(),
        description: `Suggested role: ${t.role}. Estimated ${t.days} days.`,
        project_id: projectId,
        assignee_id: t.assigneeId,
        reporter_id: ctx.meId,
        status: "todo",
        priority: t.priority,
        start_date: iso(start),
        due_date: iso(addDays(start, Math.max(1, t.days))),
        labels: ["ai-plan"],
      };
    });
  const { data: created, error: te } = rows.length
    ? await ctx.sb.from("tasks").insert(rows).select("id, assignee_id, title")
    : { data: [], error: null };
  if (te) {
    await resolve(ctx, id, "failed", { projectId, error: te.message });
    return {
      ok: false as const,
      error: `Project created but tasks failed: ${te.message}`,
      projectId,
    };
  }
  await logAi(
    ctx,
    `created project “${plan.name}” with ${created?.length ?? 0} tasks from an approved plan`,
    projectId,
  );
  for (const t of created ?? [])
    if (t.assignee_id)
      await notify(
        ctx,
        t.assignee_id,
        "assignment",
        `${ctx.meName} assigned you “${t.title}” in ${plan.name}`,
        projectId,
      );
  await resolve(ctx, id, "applied", {
    projectId,
    taskIds: (created ?? []).map((t) => t.id),
    finalPlan: plan,
  });
  return { ok: true as const, projectId, taskCount: created?.length ?? 0 };
}

export async function rejectProposal(ctx: OpsContext, id: string) {
  const { data } = await ctx.sb
    .from("ai_actions")
    .select("status")
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!data || data.status !== "pending")
    return { ok: false as const, error: "Nothing to cancel." };
  await resolve(ctx, id, "rejected", null);
  return { ok: true as const };
}
