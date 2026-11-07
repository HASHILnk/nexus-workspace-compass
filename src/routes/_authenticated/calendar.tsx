import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { projectById } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { PageHeader, colorClass } from "@/components/nexus/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: pageHead("Calendar", "Task deadlines and project milestones by month, week or day."),
  component: CalendarPage,
});

function CalendarPage() {
  const { state, ui } = useStore();
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [proj, setProj] = useState("all");
  const [who, setWho] = useState("all");

  const range =
    mode === "month"
      ? {
          start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
        }
      : mode === "week"
        ? {
            start: startOfWeek(cursor, { weekStartsOn: 1 }),
            end: endOfWeek(cursor, { weekStartsOn: 1 }),
          }
        : { start: cursor, end: cursor };
  const days = eachDayOfInterval(range);
  const tasks = state.tasks.filter(
    (t) => (proj === "all" || t.projectId === proj) && (who === "all" || t.assigneeId === who),
  );
  const milestones = state.projects
    .filter((p) => proj === "all" || p.id === proj)
    .flatMap((p) => p.milestones.map((m) => ({ ...m, p })));
  const step = (n: number) =>
    setCursor((c) =>
      mode === "month" ? addMonths(c, n) : addDays(c, n * (mode === "week" ? 7 : 1)),
    );

  return (
    <div>
      <PageHeader
        title="Calendar"
        actions={
          <>
            <Select value={proj} onValueChange={setProj}>
              <SelectTrigger className="h-9 w-40" aria-label="Project filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {state.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="h-9 w-40" aria-label="Assignee filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {state.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => ui.setCreateTaskOpen({})}>
              <Plus className="size-4" />
              Task
            </Button>
          </>
        }
      />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous"
            onClick={() => step(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next"
            onClick={() => step(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-2 text-sm font-semibold">
            {format(cursor, mode === "day" ? "EEEE, MMMM d, yyyy" : "MMMM yyyy")}
          </h2>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(["month", "week", "day"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs capitalize",
                mode === m ? "bg-card font-medium shadow-card" : "text-muted-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {mode !== "day" && (
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
        )}
        <div className={cn("grid", mode === "day" ? "grid-cols-1" : "grid-cols-7")}>
          {days.map((day) => {
            const iso = formatISO(day, { representation: "date" });
            const dt = tasks.filter((t) => t.dueDate === iso);
            const dm = milestones.filter((m) => m.date === iso);
            return (
              <div
                key={iso}
                className={cn(
                  "group border-b border-r p-1.5",
                  mode === "month" ? "min-h-24" : "min-h-64",
                  mode === "month" && !isSameMonth(day, cursor) && "bg-muted/30",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      isToday(day) && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <button
                    aria-label={`Add task on ${iso}`}
                    onClick={() => ui.setCreateTaskOpen({ dueDate: iso })}
                    className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {dm.map((m) => (
                    <div
                      key={m.id}
                      className="truncate rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium"
                    >
                      ◆ {m.title}
                    </div>
                  ))}
                  {dt.slice(0, mode === "month" ? 3 : 20).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => ui.setOpenTaskId(t.id)}
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-muted",
                        t.status === "done" && "text-muted-foreground line-through",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          colorClass(projectById(state, t.projectId)?.color ?? ""),
                        )}
                      />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {mode === "month" && dt.length > 3 && (
                    <p className="px-1.5 text-[10px] text-muted-foreground">
                      +{dt.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
