import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyBulkProposal,
  applyPlanProposal,
  rejectProposal,
  resolveContext,
  type PlanInput,
} from "@/lib/ai/workspace-ops";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_threads")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_threads")
      .insert({ user_id: context.userId })
      .select("id, title, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return data;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("ai_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: thread } = await context.supabase
      .from("ai_threads")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!thread) return { found: false, messagesJson: "[]" };
    const { data: rows, error } = await context.supabase
      .from("ai_messages")
      .select("message")
      .eq("thread_id", data.id)
      .order("created_at");
    if (error) throw new Error(error.message);
    // UI messages are sent as JSON text: their open-ended metadata isn't typed as serializable.
    return { found: true, messagesJson: JSON.stringify((rows ?? []).map((r) => r.message)) };
  });

export const confirmBulkChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { proposalId: string }) => d)
  .handler(async ({ context, data }) =>
    applyBulkProposal(
      await resolveContext(context.supabase, context.userId, null),
      data.proposalId,
    ),
  );

export const confirmProjectPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { proposalId: string; plan: PlanInput }) => d)
  .handler(async ({ context, data }) =>
    applyPlanProposal(
      await resolveContext(context.supabase, context.userId, null),
      data.proposalId,
      data.plan,
    ),
  );

export const cancelProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { proposalId: string }) => d)
  .handler(async ({ context, data }) =>
    rejectProposal(await resolveContext(context.supabase, context.userId, null), data.proposalId),
  );

export const listAiActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_actions")
      .select("id, tool, status, summary, member_id, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  });

export const getProposalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: { ids: string[] }) => d)
  .handler(async ({ context, data }) => {
    if (!data.ids.length) return [];
    const { data: rows } = await context.supabase
      .from("ai_actions")
      .select("id, status, result")
      .in("id", data.ids);
    return (rows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      resultJson: JSON.stringify(r.result ?? null),
    }));
  });
