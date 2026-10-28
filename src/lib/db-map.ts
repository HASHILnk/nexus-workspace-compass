// Converts between database rows (snake_case) and the app's workspace types.
import type { Database } from "@/integrations/supabase/types";
import type { Activity, Doc, Member, Milestone, Notification, Project, Subtask, Comment, Task } from "./types";

type Tables = Database["public"]["Tables"];
export type Role = Database["public"]["Enums"]["app_role"];

export const toMember = (r: Tables["members"]["Row"]): Member & { userId: string | null; email: string | null } => ({
  id: r.id, name: r.name, role: r.role, initials: r.initials, color: r.color,
  availability: r.availability as Member["availability"], userId: r.user_id, email: r.email,
});

export const toProject = (r: Tables["projects"]["Row"]): Project => ({
  id: r.id, name: r.name, description: r.description, ownerId: r.owner_id ?? "", memberIds: r.member_ids,
  status: r.status as Project["status"], priority: r.priority as Project["priority"], startDate: r.start_date,
  deadline: r.deadline, color: r.color, milestones: (r.milestones as unknown as Milestone[]) ?? [],
});

export const toTask = (r: Tables["tasks"]["Row"]): Task => ({
  id: r.id, title: r.title, description: r.description, projectId: r.project_id, assigneeId: r.assignee_id,
  reporterId: r.reporter_id ?? "", status: r.status as Task["status"], priority: r.priority as Task["priority"],
  startDate: r.start_date, dueDate: r.due_date, labels: r.labels, subtasks: (r.subtasks as unknown as Subtask[]) ?? [],
  dependsOn: r.depends_on, comments: (r.comments as unknown as Comment[]) ?? [], createdAt: r.created_at,
});

export const toActivity = (r: Tables["activity"]["Row"]): Activity => ({
  id: r.id, actorId: r.actor_id, text: r.text, projectId: r.project_id ?? undefined, createdAt: r.created_at,
});

export const toNotification = (r: Tables["notifications"]["Row"]): Notification => ({
  id: r.id, kind: r.kind as Notification["kind"], text: r.text, createdAt: r.created_at, read: r.read, projectId: r.project_id ?? undefined,
});

export const toDoc = (r: Tables["docs"]["Row"]): Doc => ({
  id: r.id, title: r.title, projectId: r.project_id ?? "", updatedAt: r.updated_at, authorId: r.author_id ?? "",
});

export function taskPatchToRow(p: Partial<Task>): Tables["tasks"]["Update"] {
  const o: Tables["tasks"]["Update"] = {};
  if (p.title !== undefined) o.title = p.title;
  if (p.description !== undefined) o.description = p.description;
  if (p.projectId !== undefined) o.project_id = p.projectId;
  if (p.assigneeId !== undefined) o.assignee_id = p.assigneeId;
  if (p.status !== undefined) o.status = p.status;
  if (p.priority !== undefined) o.priority = p.priority;
  if (p.startDate !== undefined) o.start_date = p.startDate;
  if (p.dueDate !== undefined) o.due_date = p.dueDate;
  if (p.labels !== undefined) o.labels = p.labels;
  if (p.subtasks !== undefined) o.subtasks = p.subtasks as never;
  if (p.dependsOn !== undefined) o.depends_on = p.dependsOn;
  if (p.comments !== undefined) o.comments = p.comments as never;
  return o;
}

export const taskToRow = (t: Task): Tables["tasks"]["Insert"] => ({
  id: t.id, title: t.title, project_id: t.projectId, reporter_id: t.reporterId || null, ...taskPatchToRow(t),
});

export function projectPatchToRow(p: Partial<Project>): Tables["projects"]["Update"] {
  const o: Tables["projects"]["Update"] = {};
  if (p.name !== undefined) o.name = p.name;
  if (p.description !== undefined) o.description = p.description;
  if (p.ownerId !== undefined) o.owner_id = p.ownerId || null;
  if (p.memberIds !== undefined) o.member_ids = p.memberIds;
  if (p.status !== undefined) o.status = p.status;
  if (p.priority !== undefined) o.priority = p.priority;
  if (p.startDate !== undefined) o.start_date = p.startDate;
  if (p.deadline !== undefined) o.deadline = p.deadline;
  if (p.color !== undefined) o.color = p.color;
  if (p.milestones !== undefined) o.milestones = p.milestones as never;
  return o;
}
