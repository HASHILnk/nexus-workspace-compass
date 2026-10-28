import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { PageHeader } from "@/components/nexus/bits";
import { Timeline } from "@/components/nexus/timeline";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: pageHead("Timeline", "Gantt-style schedule of tasks, milestones and dependencies."),
  component: TimelinePage,
});

function TimelinePage() {
  const { state } = useStore();
  const [proj, setProj] = useState(state.projects[0]?.id ?? "all");
  const p = state.projects.find((x) => x.id === proj);
  const tasks = state.tasks.filter((t) => proj === "all" || t.projectId === proj);
  return (
    <div>
      <PageHeader title="Timeline" subtitle="Dashed lines show task dependencies; diamonds are milestones." actions={
        <Select value={proj} onValueChange={setProj}><SelectTrigger className="h-9 w-48" aria-label="Project"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{state.projects.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select>} />
      <Timeline tasks={tasks} milestones={p?.milestones ?? state.projects.flatMap((x) => x.milestones)} deadline={p?.deadline} />
    </div>
  );
}
