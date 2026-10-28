import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AlertCircle, Bot, CheckCircle2, FolderKanban, LayoutGrid, List, ListChecks, Plus, TrendingUp, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { daysUntil, isOverdue, memberById, projectById, workspaceKpis } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { Bar, DueLabel, MemberAvatar, Panel, colorClass } from "@/components/nexus/bits";
import { ProjectCard, ProjectRow } from "@/components/nexus/project-card";
import { TaskTable } from "@/components/nexus/task-table";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: pageHead("Overview", "Your workspace at a glance: projects, tasks, deadlines and team activity."),
  component: Overview,
});

function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

function Overview() {
  const { state, ui } = useStore();
  const k = workspaceKpis(state);
  const me = memberById(state, state.meId);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [scope, setScope] = useState("all");

  const projects = state.projects.filter((p) => (filter === "all" || p.status === filter) && (scope === "all" || p.id === scope));
  const myTasks = state.tasks.filter((t) => t.assigneeId === state.meId && (scope === "all" || t.projectId === scope));
  const deadlines = useMemo(() => state.tasks.filter((t) => t.status !== "done" && daysUntil(t.dueDate) <= 7 && (scope === "all" || t.projectId === scope)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6), [state.tasks, scope]);

  const kpis = [
    { label: "Active Projects", value: k.activeProjects, sub: `${k.nearing} nearing completion`, icon: FolderKanban, tone: "text-primary bg-primary-soft" },
    { label: "My Tasks", value: k.myTasks, sub: `${k.dueWeek} due this week`, icon: ListChecks, tone: "text-chart-1 bg-info-soft" },
    { label: "Completed", value: `${k.completion}%`, sub: "of all workspace tasks", icon: CheckCircle2, tone: "text-success bg-success-soft", bar: k.completion },
    { label: "Overdue Tasks", value: k.overdue, sub: `Across ${k.overdueProjects} projects`, icon: AlertCircle, tone: "text-destructive bg-destructive-soft" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting()}, {me?.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here’s what’s happening across your workspace today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={scope} onValueChange={setScope}><SelectTrigger className="h-9 w-44" aria-label="Project scope"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All projects</SelectItem>{state.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => { navigator.clipboard?.writeText(window.location.origin); toast.success("Invite link copied to clipboard"); }}><UserPlus className="size-4" />Invite</Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => ui.askAI("What should I focus on today?")}><Bot className="size-4 text-primary" />Ask AI</Button>
          <Button size="sm" className="h-9" onClick={() => ui.setCreateProjectOpen(true)}><Plus className="size-4" />Create project</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{c.label}</span><span className={cn("flex size-7 items-center justify-center rounded-lg", c.tone)}><c.icon className="size-3.5" /></span></div>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{c.value}</p>
            {c.bar !== undefined ? <Bar value={c.bar} tone="chart-3" className="mt-2" /> : null}
            <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">{c.label === "Completed" && <TrendingUp className="size-3 text-success" />}{c.sub}</p>
          </div>
        ))}
      </div>

      <Panel title="Your Projects" action={
        <div className="flex items-center gap-2">
          <div className="hidden gap-0.5 rounded-lg bg-muted p-0.5 sm:flex">
            {(["all", "in_progress", "planning", "completed", "at_risk"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2 py-1 text-xs capitalize text-muted-foreground", filter === f && "bg-card font-medium text-foreground shadow-card")}>{f.replace("_", " ")}</button>)}
          </div>
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            <button aria-label="Grid view" onClick={() => setView("grid")} className={cn("rounded-md p-1", view === "grid" && "bg-card shadow-card")}><LayoutGrid className="size-3.5" /></button>
            <button aria-label="List view" onClick={() => setView("list")} className={cn("rounded-md p-1", view === "list" && "bg-card shadow-card")}><List className="size-3.5" /></button>
          </div>
        </div>}>
        {projects.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No projects in this filter.</p> : view === "grid"
          ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{projects.slice(0, 8).map((p) => <ProjectCard key={p.id} project={p} />)}</div>
          : <div>{projects.map((p) => <ProjectRow key={p.id} project={p} />)}</div>}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title="My Tasks" action={<Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>}>
          <TaskTable tasks={myTasks} compact />
        </Panel>
        <div className="space-y-6">
          <Panel title="Upcoming deadlines">
            <ul>{deadlines.map((t) => (
              <li key={t.id}><button onClick={() => ui.setOpenTaskId(t.id)} className={cn("flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-0 hover:bg-muted/40", isOverdue(t) && "bg-destructive-soft/40")}>
                <span className={cn("h-8 w-1 shrink-0 rounded-full", colorClass(projectById(state, t.projectId)?.color ?? ""))} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{t.title}</span><span className="block truncate text-[11px] text-muted-foreground">{projectById(state, t.projectId)?.name}</span></span>
                <span className="flex flex-col items-end gap-1"><DueLabel date={t.dueDate} /><MemberAvatar member={memberById(state, t.assigneeId)} size="xs" /></span>
              </button></li>))}
              {deadlines.length === 0 && <li className="p-6 text-center text-xs text-muted-foreground">Nothing due this week.</li>}
            </ul>
          </Panel>
          <Panel title="Recent activity">
            <ul className="space-y-3 p-4">{state.activity.slice(0, 6).map((a) => {
              const m = a.actorId === "ai" ? null : memberById(state, a.actorId);
              const p = projectById(state, a.projectId);
              return (
                <li key={a.id} className="flex gap-2.5">
                  {m ? <MemberAvatar member={m} size="sm" /> : <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Bot className="size-3.5" /></span>}
                  <div className="min-w-0 text-xs">
                    <p><span className="font-medium">{m?.name.split(" ")[0] ?? "Nexus AI"}</span> <span className="text-muted-foreground">{a.text}</span></p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}{p && <> · <Link to="/projects/$projectId" params={{ projectId: p.id }} className="hover:text-foreground hover:underline">{p.name}</Link></>}</p>
                  </div>
                </li>);
            })}</ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
