import { useState } from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { uid, useActions, useStore } from "@/lib/store";
import { PRIORITIES, STATUSES, type Priority, type Status } from "@/lib/types";
import { memberById } from "@/lib/selectors";
import { MemberAvatar, StatusPill } from "./bits";

export function TaskDrawer() {
  const { state, ui } = useStore();
  const { updateTask, deleteTask } = useActions();
  const task = state.tasks.find((t) => t.id === ui.openTaskId);
  const [comment, setComment] = useState("");
  const [sub, setSub] = useState("");
  const [confirm, setConfirm] = useState(false);

  const close = () => ui.setOpenTaskId(null);
  if (!task) return <Sheet open={false} />;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 py-1"><span className="text-xs text-muted-foreground">{label}</span><div className="min-w-0">{children}</div></div>
  );
  const members = state.members;
  const projectTasks = state.tasks.filter((t) => t.projectId === task.projectId && t.id !== task.id);

  const addComment = () => {
    if (!comment.trim()) return;
    updateTask(task.id, { comments: [...task.comments, { id: uid("c"), authorId: state.meId, body: comment.trim(), createdAt: new Date().toISOString() }] }, "commented on");
    setComment("");
  };

  return (
    <Sheet open={!!task} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg [&>button]:hidden">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-3">
          <StatusPill status={task.status} />
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" aria-label="Delete task" onClick={() => setConfirm(true)}><Trash2 className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={close}><X className="size-4" /></Button>
          </div>
        </div>
        <div className="space-y-5 px-5 py-4">
          <div>
            <SheetTitle className="sr-only">{task.title}</SheetTitle>
            <SheetDescription className="sr-only">Task details</SheetDescription>
            <Input aria-label="Task title" defaultValue={task.title} key={task.id + "t"} onBlur={(e) => e.target.value.trim() && e.target.value !== task.title && updateTask(task.id, { title: e.target.value.trim() }, "renamed")} className="h-auto border-transparent px-0 text-lg font-semibold shadow-none focus-visible:border-input focus-visible:px-2" />
            <Textarea aria-label="Description" defaultValue={task.description} key={task.id + "d"} placeholder="Add a description…" onBlur={(e) => e.target.value !== task.description && updateTask(task.id, { description: e.target.value })} className="mt-1 min-h-16 border-transparent px-0 text-sm text-muted-foreground shadow-none focus-visible:border-input focus-visible:px-2" />
          </div>

          <div className="rounded-lg border p-3">
            <Row label="Status">
              <Select value={task.status} onValueChange={(v) => updateTask(task.id, { status: v as Status }, "updated status of")}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
            </Row>
            <Row label="Priority">
              <Select value={task.priority} onValueChange={(v) => updateTask(task.id, { priority: v as Priority }, "changed priority of")}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
            </Row>
            <Row label="Assignee">
              <Select value={task.assigneeId ?? "none"} onValueChange={(v) => updateTask(task.id, { assigneeId: v === "none" ? null : v }, "reassigned")}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Unassigned</SelectItem>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
            </Row>
            <Row label="Reporter"><span className="inline-flex items-center gap-2 text-sm"><MemberAvatar member={memberById(state, task.reporterId)} size="xs" />{memberById(state, task.reporterId)?.name}</span></Row>
            <Row label="Project">
              <Select value={task.projectId} onValueChange={(v) => updateTask(task.id, { projectId: v }, "moved")}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{state.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </Row>
            <Row label="Start date"><Input type="date" className="h-8 text-sm" value={task.startDate} onChange={(e) => e.target.value && updateTask(task.id, { startDate: e.target.value })} /></Row>
            <Row label="Due date"><Input type="date" className="h-8 text-sm" value={task.dueDate} onChange={(e) => e.target.value && updateTask(task.id, { dueDate: e.target.value }, "changed due date of")} /></Row>
            <Row label="Labels">
              <Input className="h-8 text-sm" defaultValue={task.labels.join(", ")} key={task.id + "l"} placeholder="design, bug" onBlur={(e) => updateTask(task.id, { labels: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
            </Row>
          </div>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subtasks · {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}</h3>
            <div className="space-y-1">
              {task.subtasks.map((s) => (
                <label key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50">
                  <Checkbox checked={s.done} onCheckedChange={(c) => updateTask(task.id, { subtasks: task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !!c } : x)) })} />
                  <span className={s.done ? "text-muted-foreground line-through" : ""}>{s.title}</span>
                </label>
              ))}
            </div>
            <form className="mt-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!sub.trim()) return; updateTask(task.id, { subtasks: [...task.subtasks, { id: uid("st"), title: sub.trim(), done: false }] }); setSub(""); }}>
              <Input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Add subtask" className="h-8 text-sm" aria-label="New subtask" />
              <Button size="sm" variant="outline" type="submit"><Plus className="size-3.5" /></Button>
            </form>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Depends on</h3>
            <div className="flex flex-wrap gap-1.5">
              {task.dependsOn.map((id) => {
                const dep = state.tasks.find((t) => t.id === id);
                return dep && <span key={id} className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs">{dep.title}<button aria-label="Remove dependency" onClick={() => updateTask(task.id, { dependsOn: task.dependsOn.filter((x) => x !== id) })}><X className="size-3" /></button></span>;
              })}
              <Select value="" onValueChange={(v) => updateTask(task.id, { dependsOn: [...task.dependsOn, v] }, "added a dependency to")}>
                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="+ Add dependency" /></SelectTrigger>
                <SelectContent>{projectTasks.filter((t) => !task.dependsOn.includes(t.id)).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</h3>
            <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">File uploads need cloud storage, which isn’t connected yet.</p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</h3>
            <div className="space-y-3">
              {task.comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <MemberAvatar member={memberById(state, c.authorId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs"><span className="font-medium">{memberById(state, c.authorId)?.name}</span> <span className="text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span></p>
                    <p className="mt-0.5 text-sm">{c.body.split(/(@\w+)/).map((part, i) => part.startsWith("@") ? <span key={i} className="font-medium text-primary">{part}</span> : part)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment… use @name to mention" className="min-h-10 text-sm" aria-label="New comment" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }} />
              <Button onClick={addComment} disabled={!comment.trim()}>Send</Button>
            </div>
          </section>
          <p className="text-[11px] text-muted-foreground">Created {format(parseISO(task.createdAt), "MMM d, yyyy")}</p>
        </div>

        <AlertDialog open={confirm} onOpenChange={setConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete this task?</AlertDialogTitle><AlertDialogDescription>“{task.title}” will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { deleteTask(task.id); close(); toast.success("Task deleted"); }}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
