import { useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { useActions, useStore } from "@/lib/store";
import { STATUSES, type Status, type Task } from "@/lib/types";
import { memberById } from "@/lib/selectors";
import { DueLabel, MemberAvatar, PriorityPill } from "./bits";
import { cn } from "@/lib/utils";

export function Kanban({ tasks, projectId }: { tasks: Task[]; projectId?: string }) {
  const { state, ui } = useStore();
  const { updateTask } = useActions();
  const [over, setOver] = useState<Status | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUSES.map((col) => {
        const items = tasks.filter((t) => t.status === col.id);
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              const t = tasks.find((x) => x.id === id);
              if (t && t.status !== col.id)
                updateTask(id, { status: col.id }, `moved to ${col.label}:`);
            }}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40 p-2 transition-colors",
              over === col.id && "border-primary bg-primary-soft",
            )}
          >
            <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
              <span className="text-xs font-semibold">
                {col.label} <span className="ml-1 text-muted-foreground">{items.length}</span>
              </span>
              <button
                aria-label={`Add task to ${col.label}`}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => ui.setCreateTaskOpen(projectId ? { projectId } : {})}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <div className="flex min-h-24 flex-col gap-2">
              {items.map((t) => (
                <button
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  onClick={() => ui.setOpenTaskId(t.id)}
                  className="cursor-grab rounded-lg border bg-card p-3 text-left shadow-card transition-shadow hover:shadow-pop active:cursor-grabbing"
                >
                  <p className="text-sm font-medium leading-snug">{t.title}</p>
                  {t.labels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.labels.map((l) => (
                        <span
                          key={l}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PriorityPill priority={t.priority} />
                      {t.comments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <MessageSquare className="size-3" />
                          {t.comments.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DueLabel date={t.dueDate} done={t.status === "done"} />
                      <MemberAvatar member={memberById(state, t.assigneeId)} size="xs" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
