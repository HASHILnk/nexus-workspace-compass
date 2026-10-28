import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActions, useStore } from "@/lib/store";
import { projectStats } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/types";
import { Empty, PageHeader, Panel } from "@/components/nexus/bits";
import { ProjectCard, ProjectRow } from "@/components/nexus/project-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: pageHead("Projects", "All workspace projects in grid, list or board view."),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { state, ui } = useStore();
  const { updateProject } = useActions();
  const [view, setView] = useState<"grid" | "list" | "board">("grid");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("deadline");
  const list = state.projects
    .filter((p) => (status === "all" || p.status === status) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "progress" ? projectStats(b, state.tasks).progress - projectStats(a, state.tasks).progress : a.deadline.localeCompare(b.deadline));

  return (
    <div>
      <PageHeader title="Projects" subtitle={`${state.projects.length} projects in Acme Inc.`} actions={<Button size="sm" onClick={() => ui.setCreateProjectOpen(true)}><Plus className="size-4" />Create project</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" className="h-9 pl-8" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-40" aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{PROJECT_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
        <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-9 w-40" aria-label="Sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="deadline">Sort: Deadline</SelectItem><SelectItem value="name">Sort: Name</SelectItem><SelectItem value="progress">Sort: Progress</SelectItem></SelectContent></Select>
        <div className="ml-auto flex gap-0.5 rounded-lg bg-muted p-0.5">{(["grid", "list", "board"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 text-xs capitalize", view === v ? "bg-card font-medium shadow-card" : "text-muted-foreground")}>{v}</button>)}</div>
      </div>
      {list.length === 0 ? <Panel><Empty title="No projects found" hint="Adjust your search or create a new project." /></Panel>
        : view === "grid" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
        : view === "list" ? <Panel>{list.map((p) => <ProjectRow key={p.id} project={p} />)}</Panel>
        : <div className="grid gap-3 md:grid-cols-4">{PROJECT_STATUSES.map((s) => (
          <div key={s.id} className="rounded-xl border bg-muted/40 p-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => updateProject(e.dataTransfer.getData("text/plain"), { status: s.id as ProjectStatus })}>
            <p className="px-1.5 pb-2 pt-1 text-xs font-semibold">{s.label} <span className="text-muted-foreground">{list.filter((p) => p.status === s.id).length}</span></p>
            <div className="space-y-2">{list.filter((p) => p.status === s.id).map((p) => <div key={p.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}><ProjectCard project={p} /></div>)}</div>
          </div>))}</div>}
    </div>
  );
}
