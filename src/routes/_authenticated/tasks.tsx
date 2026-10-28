import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { PageHeader, Panel } from "@/components/nexus/bits";
import { TaskTable } from "@/components/nexus/task-table";
import { Kanban } from "@/components/nexus/kanban";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: pageHead("My Tasks", "Every task assigned to you, with filters, sorting and a board view."),
  component: TasksPage,
});

function TasksPage() {
  const { state, ui } = useStore();
  const [who, setWho] = useState<"me" | "all">("me");
  const [view, setView] = useState<"list" | "board">("list");
  const tasks = state.tasks.filter((t) => who === "all" || t.assigneeId === state.meId);
  return (
    <div>
      <PageHeader title="My Tasks" subtitle={`${tasks.filter((t) => t.status !== "done").length} open tasks`} actions={<>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">{(["me", "all"] as const).map((v) => <button key={v} onClick={() => setWho(v)} className={cn("rounded-md px-2.5 py-1 text-xs", who === v ? "bg-card font-medium shadow-card" : "text-muted-foreground")}>{v === "me" ? "Assigned to me" : "All tasks"}</button>)}</div>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">{(["list", "board"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-2.5 py-1 text-xs capitalize", view === v ? "bg-card font-medium shadow-card" : "text-muted-foreground")}>{v}</button>)}</div>
        <Button size="sm" onClick={() => ui.setCreateTaskOpen({})}><Plus className="size-4" />New task</Button>
      </>} />
      {view === "list" ? <Panel><TaskTable tasks={tasks} /></Panel> : <Kanban tasks={tasks} />}
    </div>
  );
}
