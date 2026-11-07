import { useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { useStore } from "@/lib/store";
import type { Milestone, Task } from "@/lib/types";
import { colorClass } from "./bits";
import { projectById } from "@/lib/selectors";
import { cn } from "@/lib/utils";

export function Timeline({
  tasks,
  milestones = [],
  deadline,
}: {
  tasks: Task[];
  milestones?: Milestone[];
  deadline?: string | undefined;
}) {
  const { state, ui } = useStore();
  const [mode, setMode] = useState<"week" | "month">("week");
  const days = mode === "week" ? 28 : 84;
  const dayW = mode === "week" ? 32 : 10;
  const start = startOfWeek(addDays(new Date(), mode === "week" ? -7 : -21), { weekStartsOn: 1 });
  const x = (iso: string) => differenceInCalendarDays(parseISO(iso), start) * dayW;
  const todayX = differenceInCalendarDays(new Date(), start) * dayW;
  const sorted = [...tasks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const rowOf = Object.fromEntries(sorted.map((t, i) => [t.id, i]));
  const ROW = 34;

  return (
    <div>
      <div className="mb-3 flex justify-end gap-0.5">
        <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
          {(["week", "month"] as const).map((m) => (
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
      <div className="flex overflow-hidden rounded-2xl border bg-card">
        <div className="w-52 shrink-0 border-r">
          <div className="h-9 border-b bg-muted/40 px-3 text-[11px] font-medium uppercase leading-9 text-muted-foreground">
            Task
          </div>
          {sorted.map((t) => (
            <button
              key={t.id}
              onClick={() => ui.setOpenTaskId(t.id)}
              className="block w-full truncate border-b px-3 text-left text-xs hover:bg-muted/40"
              style={{ height: ROW, lineHeight: `${ROW}px` }}
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div
            className="relative"
            style={{ width: days * dayW, height: 36 + sorted.length * ROW }}
          >
            <div className="flex h-9 border-b bg-muted/40">
              {Array.from({ length: days / 7 }).map((_, i) => (
                <div
                  key={i}
                  className="border-r px-2 text-[11px] leading-9 text-muted-foreground"
                  style={{ width: 7 * dayW }}
                >
                  {format(addDays(start, i * 7), "MMM d")}
                </div>
              ))}
            </div>
            {Array.from({ length: days / 7 }).map((_, i) => (
              <div
                key={i}
                className="absolute bottom-0 top-9 border-r border-dashed"
                style={{ left: (i + 1) * 7 * dayW }}
              />
            ))}
            <div className="absolute bottom-0 top-0 z-10 w-px bg-primary" style={{ left: todayX }}>
              <span className="absolute -left-4 top-1 rounded bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                Today
              </span>
            </div>
            {deadline && (
              <div
                className="absolute bottom-0 top-9 w-px bg-destructive"
                style={{ left: x(deadline) }}
                title="Deadline"
              />
            )}
            {milestones.map((m) => (
              <div
                key={m.id}
                title={m.title}
                className={cn(
                  "absolute top-[30px] z-10 size-3 rotate-45 border-2 border-card",
                  m.done ? "bg-success" : "bg-warning",
                )}
                style={{ left: x(m.date) - 6 }}
              />
            ))}
            <svg
              className="pointer-events-none absolute left-0 top-9"
              width={days * dayW}
              height={sorted.length * ROW}
            >
              {sorted.flatMap((t) =>
                t.dependsOn
                  .filter((d) => rowOf[d] !== undefined)
                  .map((d) => {
                    const dep = state.tasks.find((z) => z.id === d)!;
                    const x1 = x(dep.dueDate) + dayW,
                      y1 = rowOf[d]! * ROW + ROW / 2,
                      x2 = x(t.startDate),
                      y2 = rowOf[t.id]! * ROW + ROW / 2;
                    return (
                      <path
                        key={t.id + d}
                        d={`M${x1},${y1} C${x1 + 16},${y1} ${x2 - 16},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="var(--muted-foreground)"
                        strokeWidth="1.2"
                        strokeDasharray="3 2"
                      />
                    );
                  }),
              )}
            </svg>
            {sorted.map((t, i) => {
              const left = x(t.startDate),
                w = Math.max(dayW, x(t.dueDate) - left + dayW);
              return (
                <button
                  key={t.id}
                  onClick={() => ui.setOpenTaskId(t.id)}
                  title={`${t.title}: ${t.startDate} → ${t.dueDate}`}
                  className={cn(
                    "absolute h-5 rounded-md opacity-90 transition-opacity hover:opacity-100",
                    colorClass(projectById(state, t.projectId)?.color ?? ""),
                    t.status === "done" && "opacity-40",
                  )}
                  style={{ left, width: w, top: 36 + i * ROW + 7 }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
