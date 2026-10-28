import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Bot, MoreHorizontal, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Bar as RBar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useActions, useStore } from "@/lib/store";
import { isOverdue, memberById, projectStats } from "@/lib/selectors";
import { PROJECT_STATUSES, STATUSES } from "@/lib/types";
import { AvatarStack, Bar, DueLabel, Empty, HealthBadge, MemberAvatar, Panel, ProjectStatusPill, colorClass } from "@/components/nexus/bits";
import { TaskTable } from "@/components/nexus/task-table";
import { Kanban } from "@/components/nexus/kanban";
import { Timeline } from "@/components/nexus/timeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({ meta: [
    { title: "Project · NEXUS" }, { name: "description", content: "Project workspace with tasks, board, timeline and activity." },
    { property: "og:title", content: "Project · NEXUS" }, { property: "og:description", content: "Project workspace with tasks, board, timeline and activity." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const { state, ui } = useStore();
  const { updateProject } = useActions();
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return <Panel><Empty title="Project not found" hint="It may have been removed." /><div className="pb-6 text-center"><Link to="/projects" className="text-sm text-primary hover:underline">Back to projects</Link></div></Panel>;
  const s = projectStats(p, state.tasks);
  const members = p.memberIds.map((id) => memberById(state, id)!).filter(Boolean);
  const chart = STATUSES.map((st) => ({ name: st.label, count: s.tasks.filter((t) => t.status === st.id).length }));
  const workload = members.map((m) => ({ m, n: s.tasks.filter((t) => t.assigneeId === m.id && t.status !== "done").length }));
  const maxLoad = Math.max(1, ...workload.map((w) => w.n));
  const activity = state.activity.filter((a) => a.projectId === p.id);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-primary-foreground", colorClass(p.color))}>{p.name[0]}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">{p.name}</h1><ProjectStatusPill status={p.status} /><HealthBadge value={s.health} /></div>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><MemberAvatar member={memberById(state, p.ownerId)} size="xs" />{memberById(state, p.ownerId)?.name}</span>
              <AvatarStack members={members} />
              <span className="flex items-center gap-2"><Bar value={s.progress} tone={p.color} className="w-24" />{s.progress}%</span>
              <span>Due <span className="font-medium text-foreground">{format(parseISO(p.deadline), "MMM d, yyyy")}</span></span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => ui.askAI(`Summarize what happened in the ${p.name} project`)}><Bot className="size-4 text-primary" />Summarize</Button>
          <Button size="sm" onClick={() => ui.setCreateTaskOpen({ projectId: p.id })}><Plus className="size-4" />Task</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-8" aria-label="More actions"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PROJECT_STATUSES.map((st) => <DropdownMenuItem key={st.id} onClick={() => { updateProject(p.id, { status: st.id }); toast.success(`Marked ${st.label}`); }}>Mark as {st.label}</DropdownMenuItem>)}
              <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Project link copied"); }}><Share2 className="size-4" />Copy share link</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">{["overview", "tasks", "board", "timeline", "files", "activity"].map((t) => <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>)}</TabsList>
        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-3">
          <Panel title="Tasks by status" className="lg:col-span-2">
            <div className="h-52 p-4"><ResponsiveContainer><BarChart data={chart}><XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={24} /><Tooltip cursor={{ fill: "var(--muted)" }} /><RBar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Health & risks">
            <div className="space-y-2 p-4 text-sm">
              <p className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium">{s.done}/{s.total}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Overdue</span><span className={cn("font-medium", s.overdue && "text-destructive")}>{s.overdue}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Health</span><HealthBadge value={s.health} /></p>
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => ui.askAI(`Identify project risks for ${p.name}`)}><Bot className="size-4 text-primary" />Analyze risks</Button>
            </div>
          </Panel>
          <Panel title="Milestones">
            <ul className="space-y-1 p-3">{p.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm">
                <Checkbox checked={m.done} onCheckedChange={(c) => updateProject(p.id, { milestones: p.milestones.map((x) => (x.id === m.id ? { ...x, done: !!c } : x)) })} aria-label={m.title} />
                <span className={cn("flex-1", m.done && "text-muted-foreground line-through")}>{m.title}</span><DueLabel date={m.date} done={m.done} />
              </li>))}{p.milestones.length === 0 && <li className="p-3 text-xs text-muted-foreground">No milestones yet.</li>}</ul>
          </Panel>
          <Panel title="Team workload">
            <ul className="space-y-2.5 p-4">{workload.map(({ m, n }) => <li key={m.id} className="flex items-center gap-2.5 text-xs"><MemberAvatar member={m} size="sm" /><span className="w-24 truncate">{m.name}</span><Bar value={(n / maxLoad) * 100} tone={m.color} /><span className="w-4 text-right tabular-nums">{n}</span></li>)}</ul>
          </Panel>
          <Panel title="Upcoming">
            <ul>{s.tasks.filter((t) => t.status !== "done").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5).map((t) => <li key={t.id}><button onClick={() => ui.setOpenTaskId(t.id)} className={cn("flex w-full justify-between gap-2 border-b px-4 py-2 text-left text-sm last:border-0 hover:bg-muted/40", isOverdue(t) && "bg-destructive-soft/40")}><span className="truncate">{t.title}</span><DueLabel date={t.dueDate} /></button></li>)}</ul>
          </Panel>
        </TabsContent>
        <TabsContent value="tasks"><Panel><TaskTable tasks={s.tasks} hideProject /></Panel></TabsContent>
        <TabsContent value="board"><Kanban tasks={s.tasks} projectId={p.id} /></TabsContent>
        <TabsContent value="timeline"><Timeline tasks={s.tasks} milestones={p.milestones} deadline={p.deadline} /></TabsContent>
        <TabsContent value="files"><Panel><Empty title="No files yet" hint="File storage isn’t connected yet. Documents linked to this project appear on the Documents page." /></Panel></TabsContent>
        <TabsContent value="activity"><Panel><ul className="space-y-3 p-4">{activity.map((a) => <li key={a.id} className="flex gap-2.5 text-sm">{a.actorId === "ai" ? <span className="flex size-6 items-center justify-center rounded-full bg-primary-soft text-primary"><Bot className="size-3.5" /></span> : <MemberAvatar member={memberById(state, a.actorId)} />}<p><span className="font-medium">{a.actorId === "ai" ? "Nexus AI" : memberById(state, a.actorId)?.name}</span> <span className="text-muted-foreground">{a.text} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</span></p></li>)}{activity.length === 0 && <Empty title="No activity yet" />}</ul></Panel></TabsContent>
      </Tabs>
    </div>
  );
}
