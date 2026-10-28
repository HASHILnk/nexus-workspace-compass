export type Status = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "planning" | "in_progress" | "completed" | "at_risk";
export type Health = "on_track" | "at_risk" | "off_track";

export interface Member {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string; // token name: chart-1..5 / primary
  availability: "available" | "busy" | "away";
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assigneeId: string | null;
  reporterId: string;
  status: Status;
  priority: Priority;
  startDate: string;
  dueDate: string;
  labels: string[];
  subtasks: Subtask[];
  dependsOn: string[];
  comments: Comment[];
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  date: string;
  done: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberIds: string[];
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  deadline: string;
  color: string;
  milestones: Milestone[];
}

export interface Activity {
  id: string;
  actorId: string | "ai";
  text: string;
  projectId?: string | undefined;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: "assignment" | "mention" | "comment" | "deadline" | "project";
  text: string;
  createdAt: string;
  read: boolean;
  projectId?: string | undefined;
}

export interface Doc {
  id: string;
  title: string;
  projectId: string;
  updatedAt: string;
  authorId: string;
}

export const STATUSES: { id: Status; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "done", label: "Done" },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "at_risk", label: "At Risk" },
];
