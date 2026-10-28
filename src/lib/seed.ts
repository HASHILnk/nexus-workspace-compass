import { addDays, formatISO, startOfDay } from "date-fns";
import type { Activity, Doc, Member, Notification, Project, Task, Status, Priority } from "./types";

const today = startOfDay(new Date());
export const d = (offset: number) => formatISO(addDays(today, offset), { representation: "date" });
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();



export const seedMembers: Member[] = [
  { id: "u-alex", name: "Alex Morgan", role: "Product Lead", initials: "AM", color: "primary", availability: "available" },
  { id: "u-sarah", name: "Sarah Chen", role: "Product Designer", initials: "SC", color: "chart-2", availability: "busy" },
  { id: "u-michael", name: "Michael Brooks", role: "Backend Engineer", initials: "MB", color: "chart-1", availability: "available" },
  { id: "u-priya", name: "Priya Patel", role: "Frontend Engineer", initials: "PP", color: "chart-4", availability: "available" },
  { id: "u-diego", name: "Diego Alvarez", role: "Mobile Engineer", initials: "DA", color: "chart-3", availability: "away" },
  { id: "u-emma", name: "Emma Wilson", role: "Marketing Manager", initials: "EW", color: "chart-5", availability: "busy" },
];

export const seedProjects: Project[] = [
  {
    id: "p-web", name: "Website Redesign", description: "Refresh the marketing site with the new brand system and faster pages.",
    ownerId: "u-sarah", memberIds: ["u-sarah", "u-priya", "u-alex"], status: "in_progress", priority: "high",
    startDate: d(-40), deadline: d(14), color: "primary",
    milestones: [
      { id: "m1", title: "Design sign-off", date: d(-10), done: true },
      { id: "m2", title: "Beta launch", date: d(5), done: false },
      { id: "m3", title: "Public launch", date: d(14), done: false },
    ],
  },
  {
    id: "p-ai", name: "AI Platform", description: "Internal platform for model serving, evaluation and prompt management.",
    ownerId: "u-michael", memberIds: ["u-michael", "u-priya", "u-alex"], status: "at_risk", priority: "urgent",
    startDate: d(-30), deadline: d(21), color: "chart-1",
    milestones: [
      { id: "m4", title: "Inference API alpha", date: d(-2), done: false },
      { id: "m5", title: "Eval dashboard", date: d(12), done: false },
    ],
  },
  {
    id: "p-mobile", name: "Mobile App", description: "Native iOS and Android app for on-the-go task management.",
    ownerId: "u-diego", memberIds: ["u-diego", "u-sarah", "u-michael"], status: "in_progress", priority: "high",
    startDate: d(-20), deadline: d(35), color: "chart-3",
    milestones: [
      { id: "m6", title: "Clickable prototype", date: d(-4), done: true },
      { id: "m7", title: "TestFlight build", date: d(18), done: false },
    ],
  },
  {
    id: "p-mkt", name: "Marketing Campaign", description: "Q4 launch campaign across email, social and paid channels.",
    ownerId: "u-emma", memberIds: ["u-emma", "u-sarah"], status: "in_progress", priority: "medium",
    startDate: d(-25), deadline: d(6), color: "chart-5",
    milestones: [
      { id: "m8", title: "Creative approved", date: d(-6), done: true },
      { id: "m9", title: "Campaign live", date: d(6), done: false },
    ],
  },
  {
    id: "p-api", name: "Backend API", description: "Versioned public API with rate limiting and webhooks.",
    ownerId: "u-michael", memberIds: ["u-michael", "u-alex"], status: "planning", priority: "medium",
    startDate: d(3), deadline: d(60), color: "chart-2",
    milestones: [{ id: "m10", title: "API spec review", date: d(10), done: false }],
  },
];

type T = [string, string, string | null, Status, Priority, number, number, string[]?];
const rows: T[] = [
  ["Finalize homepage design", "p-web", "u-sarah", "in_review", "high", -8, 1, ["design"]],
  ["Fix responsive navigation", "p-web", "u-priya", "in_progress", "urgent", -3, -1, ["bug"]],
  ["Write new pricing page copy", "p-web", "u-alex", "done", "medium", -14, -5],
  ["Migrate blog to new CMS", "p-web", "u-priya", "done", "medium", -20, -9],
  ["Set up analytics events", "p-web", "u-priya", "done", "low", -12, -6],
  ["Accessibility audit", "p-web", "u-sarah", "done", "high", -10, -3],
  ["Performance budget & Lighthouse pass", "p-web", "u-priya", "done", "medium", -9, -2],
  ["Launch checklist", "p-web", "u-alex", "todo", "medium", 0, 12],
  ["Implement authentication API", "p-ai", "u-michael", "in_progress", "urgent", -10, -2, ["backend"]],
  ["Model registry schema", "p-ai", "u-michael", "done", "high", -25, -15],
  ["Prompt versioning UI", "p-ai", "u-priya", "todo", "high", -2, 4],
  ["GPU autoscaling policy", "p-ai", "u-michael", "backlog", "medium", 2, 15],
  ["Eval harness MVP", "p-ai", "u-alex", "in_progress", "high", -6, -1],
  ["Usage metering", "p-ai", "u-michael", "done", "medium", -20, -10],
  ["Review onboarding flow", "p-mobile", "u-alex", "todo", "high", -1, 2, ["ux"]],
  ["Push notifications service", "p-mobile", "u-michael", "in_progress", "medium", -5, 6],
  ["Offline sync prototype", "p-mobile", "u-diego", "backlog", "high", 3, 20],
  ["Design system for mobile", "p-mobile", "u-sarah", "done", "medium", -18, -8],
  ["App store listing assets", "p-mobile", "u-sarah", "todo", "low", 5, 25],
  ["Crash reporting setup", "p-mobile", "u-diego", "done", "low", -12, -7],
  ["Email nurture sequence", "p-mkt", "u-emma", "done", "high", -20, -8],
  ["Social launch calendar", "p-mkt", "u-emma", "done", "medium", -15, -6],
  ["Paid ads creative", "p-mkt", "u-sarah", "done", "high", -12, -4],
  ["Landing page A/B test", "p-mkt", "u-emma", "in_progress", "medium", -3, 3],
  ["Prepare sprint retrospective", "p-mkt", "u-alex", "todo", "low", 0, 1],
  ["Influencer outreach list", "p-mkt", "u-emma", "done", "low", -18, -10],
  ["Draft API style guide", "p-api", "u-michael", "todo", "medium", 3, 9],
  ["Rate limiting design doc", "p-api", "u-alex", "backlog", "high", 5, 14],
];

export const seedTasks: Task[] = rows.map(([title, projectId, assigneeId, status, priority, s, due, labels], i) => ({
  id: `t-${i + 1}`,
  title,
  description: `${title} for the ${seedProjects.find((p) => p.id === projectId)!.name} project.`,
  projectId,
  assigneeId,
  reporterId: "u-alex",
  status,
  priority,
  startDate: d(s),
  dueDate: d(due),
  labels: labels ?? [],
  subtasks: i % 3 === 0 ? [
    { id: `st-${i}-1`, title: "Draft", done: true },
    { id: `st-${i}-2`, title: "Review", done: status === "done" },
  ] : [],
  dependsOn: i === 1 ? ["t-1"] : i === 12 ? ["t-10"] : [],
  comments: i === 8 ? [{ id: "c1", authorId: "u-michael", body: "Token refresh is blocked on the gateway config. @Alex can you unblock?", createdAt: ago(3) }] : [],
  createdAt: ago(200 - i),
}));

export const seedActivity: Activity[] = [
  { id: "a1", actorId: "u-sarah", text: "completed “Accessibility audit”", projectId: "p-web", createdAt: ago(0.5) },
  { id: "a2", actorId: "u-michael", text: "commented on “Implement authentication API”", projectId: "p-ai", createdAt: ago(3) },
  { id: "a3", actorId: "u-alex", text: "added “Launch checklist” to Website Redesign", projectId: "p-web", createdAt: ago(5) },
  { id: "a4", actorId: "ai", text: "generated a sprint summary for Marketing Campaign", projectId: "p-mkt", createdAt: ago(9) },
  { id: "a5", actorId: "u-diego", text: "moved “Offline sync prototype” to Backlog", projectId: "p-mobile", createdAt: ago(26) },
];

export const seedNotifications: Notification[] = [
  { id: "n1", kind: "mention", text: "Michael mentioned you in “Implement authentication API”", createdAt: ago(3), read: false, projectId: "p-ai" },
  { id: "n2", kind: "deadline", text: "“Fix responsive navigation” is overdue", createdAt: ago(6), read: false, projectId: "p-web" },
  { id: "n3", kind: "assignment", text: "You were assigned “Review onboarding flow”", createdAt: ago(20), read: false, projectId: "p-mobile" },
  { id: "n4", kind: "project", text: "AI Platform was marked At Risk", createdAt: ago(30), read: true, projectId: "p-ai" },
  { id: "n5", kind: "comment", text: "Sarah commented on “Finalize homepage design”", createdAt: ago(50), read: true, projectId: "p-web" },
];

export const seedDocs: Doc[] = [
  { id: "doc1", title: "Brand guidelines v2", projectId: "p-web", updatedAt: ago(10), authorId: "u-sarah" },
  { id: "doc2", title: "Inference API RFC", projectId: "p-ai", updatedAt: ago(30), authorId: "u-michael" },
  { id: "doc3", title: "Mobile launch brief", projectId: "p-mobile", updatedAt: ago(60), authorId: "u-diego" },
  { id: "doc4", title: "Q4 campaign plan", projectId: "p-mkt", updatedAt: ago(80), authorId: "u-emma" },
];
