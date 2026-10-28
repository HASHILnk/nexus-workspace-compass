import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useActions, useStore } from "@/lib/store";
import { PRIORITIES, STATUSES, type Status, type Task } from "@/lib/types";
import { DueLabel, Empty, MemberAvatar, PriorityPill, colorClass } from "./bits";
import { memberById, projectById } from "@/lib/selectors";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type SortKey = "title" | "project" | "priority" | "status" | "dueDate";
const prioRank = { low: 0, medium: 1, high: 2, urgent: 3 };
const statusRank = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));

export function TaskTable({ tasks, hideProject, compact, toolbar = true }: { tasks: Task[]; hideProject?: boolean; compact?: boolean; toolbar?: boolean }) {
  const { state, ui } = useStore();
  const { updateTask } = useActions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [prio, setPrio] = useState<string>("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "dueDate", dir: 1 });

  const rows = useMemo(() => {
    let r = tasks.filter((t) => (status === "all" || t.status === status) && (prio === "all" || t.priority === prio) && t.title.toLowerCase().includes(q.toLowerCase()));
    const val = (t: Task) => {
      switch (sort.k) {
        case "priority": return prioRank[t.priority];
        case "status": return statusRank[t.status];
        case "project": return projectById(state, t.projectId)?.name ?? "";
        default: return t[sort.k];
      }
    };
    r = [...r].sort((a, b) => { const x = val(a)!, y = val(b)!; return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
    return r;
  }, [tasks, q, status, prio, sort, state]);

  const H = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn("px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground", className)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {children}{sort.k === k && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <div className="relative min-w-40 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="h-8 pl-8 text-sm" />
          </div>
          <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-8 w-36 text-xs" aria-label="Filter status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
          <Select value={prio} onValueChange={setPrio}><SelectTrigger className="h-8 w-36 text-xs" aria-label="Filter priority"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All priorities</SelectItem>{PRIORITIES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40"><tr>
            <H k="title" className="pl-4">Task</H>
            {!hideProject && <H k="project">Project</H>}
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Assignee</th>
            <H k="priority">Priority</H><H k="status">Status</H><H k="dueDate">Due</H>
          </tr></thead>
          <tbody>
            {rows.map((t) => {
              const p = projectById(state, t.projectId);
              return (
                <tr key={t.id} className="group cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => ui.setOpenTaskId(t.id)}>
                  <td className={cn("pl-4 pr-3", compact ? "py-2" : "py-2.5")}>
                    <span className={cn("font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                  </td>
                  {!hideProject && <td className="px-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"><span className={cn("size-2 rounded-sm", colorClass(p?.color ?? ""))} />{p?.name}</span></td>}
                  <td className="px-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs"><MemberAvatar member={memberById(state, t.assigneeId)} size="xs" />{memberById(state, t.assigneeId)?.name.split(" ")[0] ?? "Unassigned"}</span></td>
                  <td className="px-3"><PriorityPill priority={t.priority} /></td>
                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                    <Select value={t.status} onValueChange={(v) => updateTask(t.id, { status: v as Status }, "updated status of")}>
                      <SelectTrigger className="h-7 w-32 border-transparent bg-transparent px-2 text-xs shadow-none hover:border-border" aria-label="Change status"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-3"><DueLabel date={t.dueDate} done={t.status === "done"} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="No tasks match" hint="Try clearing filters or create a new task." />}
      </div>
    </div>
  );
}
