import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActions, useStore } from "@/lib/store";
import { PRIORITIES, PROJECT_STATUSES, STATUSES, type Priority, type ProjectStatus, type Status } from "@/lib/types";
import { d } from "@/lib/seed";
import { cn } from "@/lib/utils";
import { colorClass } from "./bits";

const COLORS = ["primary", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

function Field({ label, error, children, className }: { label: string; error?: string | undefined; children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}><Label className="text-xs">{label}</Label>{children}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}

export function CreateProjectDialog() {
  const { state, ui } = useStore();
  const { addProject } = useActions();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", description: "", ownerId: state.meId, memberIds: [state.meId], startDate: d(0), deadline: d(30), priority: "medium" as Priority, status: "planning" as ProjectStatus, color: "primary" });
  const [errors, setErrors] = useState<{ name?: string; deadline?: string }>({});

  const submit = () => {
    const e: { name?: string; deadline?: string } = {};
    if (!f.name.trim()) e.name = "Project name is required";
    if (f.deadline < f.startDate) e.deadline = "Deadline must be after start date";
    setErrors(e);
    if (Object.keys(e).length) return;
    const p = addProject({ ...f, name: f.name.trim(), memberIds: Array.from(new Set([f.ownerId, ...f.memberIds])), milestones: [] });
    toast.success(`Project “${p.name}” created`);
    ui.setCreateProjectOpen(false);
    setF((x) => ({ ...x, name: "", description: "" }));
    navigate({ to: "/projects/$projectId", params: { projectId: p.id } });
  };

  return (
    <Dialog open={ui.createProjectOpen} onOpenChange={ui.setCreateProjectOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Create project</DialogTitle><DialogDescription>Set up a new project for your team.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project name" error={errors.name} className="col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Customer Portal" /></Field>
          <Field label="Description" className="col-span-2"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-16" /></Field>
          <Field label="Owner"><Select value={f.ownerId} onValueChange={(v) => setF({ ...f, ownerId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{state.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Color"><div className="flex h-9 items-center gap-1.5">{COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setF({ ...f, color: c })} className={cn("size-6 rounded-md", colorClass(c), f.color === c && "ring-2 ring-ring ring-offset-2")} />)}</div></Field>
          <Field label="Team members" className="col-span-2">
            <div className="flex flex-wrap gap-1.5">{state.members.map((m) => {
              const on = f.memberIds.includes(m.id);
              return <button key={m.id} type="button" onClick={() => setF({ ...f, memberIds: on ? f.memberIds.filter((x) => x !== m.id) : [...f.memberIds, m.id] })} className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-primary-soft text-accent-foreground" : "hover:bg-muted")}>{m.name}</button>;
            })}</div>
          </Field>
          <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label="Deadline" error={errors.deadline}><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
          <Field label="Priority"><Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Status"><Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as ProjectStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></Field>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => { ui.setCreateProjectOpen(false); ui.askAI(`Create a project plan for ${f.name.trim() || "our new project"}`); }}><Wand2 className="size-4" />Generate plan with AI</Button>
          <Button onClick={submit}>Create project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateTaskDialog() {
  const { state, ui } = useStore();
  const { addTask } = useActions();
  const preset = ui.createTaskOpen;
  const [f, setF] = useState({ title: "", description: "", projectId: "", assigneeId: state.meId, priority: "medium" as Priority, status: "todo" as Status, dueDate: d(7) });
  const [err, setErr] = useState("");
  const projectId = f.projectId || preset?.projectId || state.projects[0]?.id || "";
  const dueDate = preset?.dueDate && f.dueDate === d(7) ? preset.dueDate : f.dueDate;

  const submit = () => {
    if (!f.title.trim()) return setErr("Task title is required");
    addTask({ ...f, title: f.title.trim(), projectId, dueDate, startDate: d(0) < dueDate ? d(0) : dueDate });
    toast.success("Task created");
    setF({ ...f, title: "", description: "", projectId: "" });
    setErr("");
    ui.setCreateTaskOpen(null);
  };

  return (
    <Dialog open={!!preset} onOpenChange={(o) => !o && ui.setCreateTaskOpen(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New task</DialogTitle><DialogDescription>Add a task to a project.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title" error={err} className="col-span-2"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="What needs to be done?" /></Field>
          <Field label="Description" className="col-span-2"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-14" /></Field>
          <Field label="Project"><Select value={projectId} onValueChange={(v) => setF({ ...f, projectId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{state.projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Assignee"><Select value={f.assigneeId} onValueChange={(v) => setF({ ...f, assigneeId: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{state.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Priority"><Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as Priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Status"><Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as Status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Due date" className="col-span-2"><Input type="date" value={dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => ui.setCreateTaskOpen(null)}>Cancel</Button><Button onClick={submit}>Create task</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
