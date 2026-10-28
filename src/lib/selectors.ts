import { differenceInCalendarDays, parseISO } from "date-fns";
import type { State } from "./store";
import type { Health, Project, Task } from "./types";

export const daysUntil = (iso: string) => differenceInCalendarDays(parseISO(iso), new Date());
export const isOverdue = (t: Task) => t.status !== "done" && daysUntil(t.dueDate) < 0;

export function projectStats(p: Project, tasks: Task[]) {
  const pt = tasks.filter((t) => t.projectId === p.id);
  const done = pt.filter((t) => t.status === "done").length;
  const overdue = pt.filter(isOverdue).length;
  const progress = pt.length ? Math.round((done / pt.length) * 100) : 0;
  let health: Health = "on_track";
  if (p.status === "at_risk" || overdue >= 2) health = "at_risk";
  if (overdue >= 4 || (daysUntil(p.deadline) < 0 && progress < 100)) health = "off_track";
  return { total: pt.length, done, overdue, progress, health, tasks: pt };
}

export function workspaceKpis(s: State) {
  const active = s.projects.filter((p) => p.status !== "completed");
  const nearing = active.filter((p) => projectStats(p, s.tasks).progress >= 70).length;
  const mine = s.tasks.filter((t) => t.assigneeId === s.meId && t.status !== "done");
  const dueWeek = mine.filter((t) => { const n = daysUntil(t.dueDate); return n >= 0 && n <= 7; }).length;
  const done = s.tasks.filter((t) => t.status === "done").length;
  const completion = s.tasks.length ? Math.round((done / s.tasks.length) * 100) : 0;
  const overdue = s.tasks.filter(isOverdue);
  const overdueProjects = new Set(overdue.map((t) => t.projectId)).size;
  return { activeProjects: active.length, nearing, myTasks: mine.length, dueWeek, completion, overdue: overdue.length, overdueProjects };
}

export const memberById = (s: State, id: string | null | undefined) => s.members.find((m) => m.id === id);
export const projectById = (s: State, id: string | undefined) => s.projects.find((p) => p.id === id);
