import { createFileRoute } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { isOverdue } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { Bar, MemberAvatar, PageHeader, StatusPill } from "@/components/nexus/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team")({
  head: pageHead("Team", "Team members, roles, workload and availability."),
  component: TeamPage,
});

const avail = { available: ["Available", "bg-success"], busy: ["Busy", "bg-warning"], away: ["Away", "bg-muted-foreground"] } as const;

function TeamPage() {
  const { state, ui } = useStore();
  const max = Math.max(1, ...state.members.map((m) => state.tasks.filter((t) => t.assigneeId === m.id && t.status !== "done").length));
  return (
    <div>
      <PageHeader title="Team" subtitle={`${state.members.length} members`} actions={<Button size="sm" onClick={() => { navigator.clipboard?.writeText(window.location.origin); toast.success("Invite link copied — accounts aren’t set up yet, so invites can’t be emailed."); }}><UserPlus className="size-4" />Invite member</Button>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.members.map((m) => {
          const open = state.tasks.filter((t) => t.assigneeId === m.id && t.status !== "done");
          const od = open.filter(isOverdue).length;
          const [al, ac] = avail[m.availability];
          const current = open.find((t) => t.status === "in_progress");
          return (
            <div key={m.id} className="rounded-2xl border bg-card p-4 shadow-card">
              <div className="flex items-center gap-3">
                <MemberAvatar member={m} size="lg" />
                <div className="min-w-0 flex-1"><p className="font-semibold">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-2 rounded-full", ac)} />{al}</span>
              </div>
              <div className="mt-4 flex justify-between text-xs"><span className="text-muted-foreground">Workload</span><span><b className="tabular-nums">{open.length}</b> open{od > 0 && <span className="text-destructive"> · {od} overdue</span>}</span></div>
              <Bar value={(open.length / max) * 100} tone={m.color} className="mt-1.5" />
              <div className="mt-3 border-t pt-3">
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Working on</p>
                {current ? <button onClick={() => ui.setOpenTaskId(current.id)} className="flex w-full items-center justify-between gap-2 text-left text-sm hover:text-primary"><span className="truncate">{current.title}</span><StatusPill status={current.status} /></button> : <p className="text-xs text-muted-foreground">Nothing in progress</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
