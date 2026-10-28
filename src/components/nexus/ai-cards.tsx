// Domain cards rendered inside Nexus AI replies, built from tool results.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { memberById, projectById } from "@/lib/selectors";
import { canManage } from "@/lib/permissions";
import { cancelProposal, confirmBulkChanges, confirmProjectPlan, getProposalStatus } from "@/lib/ai.functions";
import type { PlanInput } from "@/lib/ai/workspace-ops";
import type { Task } from "@/lib/types";
import { DueLabel, MemberAvatar, PriorityPill, colorClass } from "./bits";
import { cn } from "@/lib/utils";

export function TaskRows({ ids }: { ids: string[] }) {
  const { state, ui } = useStore();
  const tasks = ids.map((id) => state.tasks.find((t) => t.id === id)).filter(Boolean) as Task[];
  if (!tasks.length) return null;
  return (
    <div className="overflow-hidden rounded-lg border">
      {tasks.slice(0, 8).map((t) => (
        <button key={t.id} onClick={() => ui.setOpenTaskId(t.id)} className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50">
          <span className={cn("size-2 shrink-0 rounded-sm", colorClass(projectById(state, t.projectId)?.color ?? ""))} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{t.title}</span>
          <DueLabel date={t.dueDate} done={t.status === "done"} />
          <MemberAvatar member={memberById(state, t.assigneeId)} size="xs" />
        </button>
      ))}
      {tasks.length > 8 && <p className="px-3 py-1.5 text-[11px] text-muted-foreground">+{tasks.length - 8} more</p>}
    </div>
  );
}

export function SavedTaskCard({ task }: { task: { id: string; title: string; assigneeId: string | null; dueDate: string; projectId: string } }) {
  const { state, ui } = useStore();
  return (
    <button onClick={() => ui.setOpenTaskId(task.id)} className="flex w-full items-center gap-2 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-left text-xs">
      <CheckCircle2 className="size-4 shrink-0 text-success" />
      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{task.title}</span><span className="text-muted-foreground">Saved · {projectById(state, task.projectId)?.name} · {memberById(state, task.assigneeId)?.name ?? "Unassigned"} · due {task.dueDate}</span></span>
    </button>
  );
}

function useProposal(id: string) {
  const fetchStatus = useServerFn(getProposalStatus);
  return useQuery({ queryKey: ["proposal", id], queryFn: async () => {
    const row = (await fetchStatus({ data: { ids: [id] } })).find((r) => r.id === id);
    return row ? { status: row.status, result: JSON.parse(row.resultJson) as unknown } : null;
  } });
}

export function BulkChangesCard({ proposalId, changes }: { proposalId: string; changes: { taskId: string; title: string; status: string | null; assigneeId: string | null; unassign: boolean | null; dueDate: string | null; priority: string | null }[] }) {
  const { state, refresh } = useStore();
  const qc = useQueryClient();
  const status = useProposal(proposalId);
  const confirm = useServerFn(confirmBulkChanges);
  const cancel = useServerFn(cancelProposal);
  const [busy, setBusy] = useState(false);
  const st = status.data?.status ?? "pending";
  const go = async (ok: boolean) => {
    setBusy(true);
    try {
      if (ok) {
        const r = await confirm({ data: { proposalId } });
        if (!r.ok) toast.error(r.error);
        else if (r.failed) toast.warning(`${r.applied} saved, ${r.failed} failed`);
        else toast.success(`${r.applied} changes saved`);
        await refresh();
      } else {
        const r = await cancel({ data: { proposalId } });
        if (!r.ok) toast.error(r.error);
      }
      await qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };
  const results = (status.data?.result as { results?: { taskId: string; ok: boolean; error?: string }[] } | null)?.results;
  return (
    <div className="rounded-xl border bg-background">
      <p className="border-b px-3 py-2 text-xs font-semibold">{changes.length} proposed changes</p>
      <ul className="divide-y text-xs">
        {changes.map((c) => {
          const r = results?.find((x) => x.taskId === c.taskId);
          const bits = [c.status && `status → ${c.status.replace("_", " ")}`, c.unassign ? "unassign" : c.assigneeId && `assign → ${memberById(state, c.assigneeId)?.name ?? c.assigneeId}`, c.dueDate && `due → ${c.dueDate}`, c.priority && `priority → ${c.priority}`].filter(Boolean);
          return <li key={c.taskId} className="flex items-start gap-2 px-3 py-1.5"><span className="min-w-0 flex-1"><span className="font-medium">{c.title}</span><span className="block text-muted-foreground">{bits.join(" · ")}</span>{r && !r.ok && <span className="block text-destructive">{r.error}</span>}</span>{r && (r.ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-destructive" />)}</li>;
        })}
      </ul>
      <div className="flex gap-1.5 border-t p-2">
        {st === "pending" ? <>
          <Button size="sm" disabled={busy || status.isLoading} onClick={() => void go(true)}>Confirm & save</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void go(false)}>Cancel</Button>
        </> : <p className="px-1 text-xs text-muted-foreground">{st === "applied" ? "Confirmed and saved." : st === "rejected" ? "Cancelled — nothing was changed." : "These changes could not be saved."}</p>}
      </div>
    </div>
  );
}

export function PlanCard({ proposalId, plan: initial }: { proposalId: string; plan: PlanInput }) {
  const { state, refresh } = useStore();
  const qc = useQueryClient();
  const status = useProposal(proposalId);
  const confirm = useServerFn(confirmProjectPlan);
  const cancel = useServerFn(cancelProposal);
  const [plan, setPlan] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = status.data?.status ?? "pending";
  const createdId = (status.data?.result as { projectId?: string } | null)?.projectId;
  const manager = canManage(state.myRole);

  const apply = async () => {
    setBusy(true);
    try {
      const r = await confirm({ data: { proposalId, plan } });
      if (!r.ok) toast.error(r.error);
      else { toast.success(`Created ${plan.name} with ${r.taskCount} tasks`); await refresh(); }
      await qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false); setOpen(false);
  };
  const discard = async () => { await cancel({ data: { proposalId } }); await qc.invalidateQueries({ queryKey: ["proposal", proposalId] }); };
  const setTask = (i: number, p: Partial<PlanInput["tasks"][number]>) => setPlan({ ...plan, tasks: plan.tasks.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  return (
    <div className="rounded-xl border bg-background">
      <div className="border-b px-3 py-2.5">
        {editing ? <Input value={plan.name} onChange={(e) => setPlan({ ...plan, name: e.target.value })} className="h-7 text-sm font-semibold" aria-label="Plan name" /> : <p className="text-sm font-semibold">{plan.name}</p>}
        <p className="text-[11px] text-muted-foreground">{plan.weeks}-week timeline · {plan.tasks.length} tasks · {plan.milestones.length} milestones</p>
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Milestones</p>
        {plan.milestones.map((m, i) => <div key={i} className="flex justify-between text-xs"><span>◆ {m.title}</span><span className="text-muted-foreground">Week {m.week}</span></div>)}
      </div>
      <div className="space-y-1 border-t px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tasks</p>
        {plan.tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {editing ? <>
              <Input value={t.title} onChange={(e) => setTask(i, { title: e.target.value })} className="h-6 flex-1 text-xs" aria-label={`Task ${i + 1}`} />
              <Select value={t.assigneeId ?? "none"} onValueChange={(v) => setTask(i, { assigneeId: v === "none" ? null : v })}>
                <SelectTrigger className="h-6 w-28 text-[11px]" aria-label="Owner"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Unassigned</SelectItem>{state.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              <button aria-label="Remove task" onClick={() => setPlan({ ...plan, tasks: plan.tasks.filter((_, j) => j !== i) })}><X className="size-3" /></button>
            </> : <>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <MemberAvatar member={memberById(state, t.assigneeId)} size="xs" />
              <PriorityPill priority={t.priority} />
              <span className="w-12 text-right text-muted-foreground">W{t.startWeek}·{t.days}d</span>
            </>}
          </div>
        ))}
      </div>
      {plan.risks.length > 0 && <div className="space-y-1 border-t px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Risks & assumptions</p>
        {plan.risks.map((r, i) => <p key={i} className="flex gap-1.5 text-xs"><AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />{r}</p>)}
      </div>}
      <div className="flex flex-wrap gap-1.5 border-t p-2">
        {st === "applied" && createdId ? <Button size="sm" variant="outline" asChild className="w-full"><Link to="/projects/$projectId" params={{ projectId: createdId }}><Check className="size-3.5" />Open project</Link></Button>
          : st === "rejected" ? <p className="px-1 text-xs text-muted-foreground">Plan discarded — nothing was created.</p>
          : st === "failed" ? <p className="px-1 text-xs text-destructive">Creating this plan failed. Ask Nexus AI to try again.</p>
          : !manager ? <p className="px-1 text-xs text-muted-foreground">Only admins and project managers can turn a plan into a project.</p>
          : <>
            <Button size="sm" disabled={busy || status.isLoading} onClick={() => setOpen(true)}>Create project</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing((e) => !e)}>{editing ? "Done editing" : "Edit plan"}</Button>
            <Button size="sm" variant="ghost" onClick={() => void discard()}>Discard</Button>
          </>}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create “{plan.name}”?</DialogTitle><DialogDescription>This saves 1 project, {plan.tasks.length} tasks and {plan.milestones.length} milestones, and notifies anyone assigned.</DialogDescription></DialogHeader>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">{plan.tasks.map((t, i) => <li key={i} className="flex justify-between gap-2"><span>{t.title}</span><span className="text-xs text-muted-foreground">{memberById(state, t.assigneeId)?.name ?? "Unassigned"}</span></li>)}</ul>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void apply()}>Confirm & create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ProjectsMini({ items }: { items: { id: string; name: string; progressPct: number; health: string; overdue: number }[] }) {
  return (
    <div className="grid gap-1.5">
      {items.map((p) => (
        <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs hover:bg-muted/50">
          <span className="font-medium">{p.name}</span>
          <span className={cn("tabular-nums", p.health === "on_track" ? "text-muted-foreground" : "text-destructive")}>{p.progressPct}%{p.overdue ? ` · ${p.overdue} overdue` : ""}</span>
        </Link>
      ))}
    </div>
  );
}
