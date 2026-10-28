import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Activity, Doc, Member, Notification, Project, Task } from "./types";
import { projectPatchToRow, taskPatchToRow, taskToRow, toActivity, toDoc, toMember, toNotification, toProject, toTask, type Role } from "./db-map";

export type WorkspaceMember = Member & { userId: string | null; email: string | null };

export interface State {
  members: WorkspaceMember[];
  projects: Project[];
  tasks: Task[];
  activity: Activity[];
  notifications: Notification[];
  docs: Doc[];
  /** Member id of the signed-in person ("" until loaded). */
  meId: string;
  myRole: Role | null;
  roles: Record<string, Role>; // keyed by auth user id
  loaded: boolean;
}

const empty = (): State => ({ members: [], projects: [], tasks: [], activity: [], notifications: [], docs: [], meId: "", myRole: null, roles: {}, loaded: false });

type Action =
  | { type: "hydrate"; state: Partial<State> }
  | { type: "addProject"; project: Project }
  | { type: "updateProject"; id: string; patch: Partial<Project> }
  | { type: "addTasks"; tasks: Task[] }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "deleteTask"; id: string }
  | { type: "log"; activity: Activity }
  | { type: "readNotification"; id: string }
  | { type: "readAll" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate": return { ...s, ...a.state };
    case "addProject": return { ...s, projects: [a.project, ...s.projects] };
    case "updateProject": return { ...s, projects: s.projects.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) };
    case "addTasks": return { ...s, tasks: [...a.tasks, ...s.tasks] };
    case "updateTask": return { ...s, tasks: s.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case "deleteTask": return { ...s, tasks: s.tasks.filter((t) => t.id !== a.id).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((x) => x !== a.id) })) };
    case "log": return { ...s, activity: [a.activity, ...s.activity].slice(0, 100) };
    case "readNotification": return { ...s, notifications: s.notifications.map((n) => (n.id === a.id ? { ...n, read: true } : n)) };
    case "readAll": return { ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) };
  }
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`;

/** Reads the full workspace from the database. */
export async function fetchWorkspace(): Promise<Partial<State>> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  const [m, p, t, a, n, d, r] = await Promise.all([
    supabase.from("members").select("*").order("created_at"),
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("docs").select("*").order("updated_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  const err = [m, p, t, a, n, d, r].find((x) => x.error)?.error;
  if (err) throw new Error(err.message);
  const members = (m.data ?? []).map(toMember);
  const roles: Record<string, Role> = {};
  (r.data ?? []).forEach((x) => (roles[x.user_id] = x.role));
  const me = members.find((x) => x.userId === userId);
  return {
    members, projects: (p.data ?? []).map(toProject), tasks: (t.data ?? []).map(toTask), activity: (a.data ?? []).map(toActivity),
    notifications: (n.data ?? []).map(toNotification), docs: (d.data ?? []).map(toDoc),
    meId: me?.id ?? "", myRole: userId ? roles[userId] ?? null : null, roles, loaded: true,
  };
}

interface UI {
  openTaskId: string | null;
  setOpenTaskId: (id: string | null) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  aiPrompt: { text: string; n: number } | null;
  askAI: (text: string) => void;
  createProjectOpen: boolean;
  setCreateProjectOpen: (v: boolean) => void;
  createTaskOpen: { projectId?: string; dueDate?: string } | null;
  setCreateTaskOpen: (v: { projectId?: string; dueDate?: string } | null) => void;
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action>; ui: UI; refresh: () => Promise<void> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, empty);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try { dispatch({ type: "hydrate", state: await fetchWorkspace() }); setLoadError(null); }
    catch (e) { setLoadError(e instanceof Error ? e.message : "Could not load the workspace"); }
  }, []);

  useEffect(() => {
    void refresh();
    // Any change by anyone (including the AI) re-syncs the whole workspace.
    const channel = supabase.channel(`workspace-${Math.random().toString(36).slice(2)}`);
    for (const table of ["members", "projects", "tasks", "activity", "notifications", "user_roles"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void refresh(), 250);
      });
    }
    channel.subscribe();
    return () => { if (timer.current) clearTimeout(timer.current); void supabase.removeChannel(channel); };
  }, [refresh]);

  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [aiPrompt, setAiPrompt] = useState<UI["aiPrompt"]>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState<UI["createTaskOpen"]>(null);

  const ui: UI = {
    openTaskId, setOpenTaskId, aiOpen, setAiOpen, aiPrompt,
    askAI: (text) => { setAiOpen(true); setAiPrompt((p) => ({ text, n: (p?.n ?? 0) + 1 })); },
    createProjectOpen, setCreateProjectOpen, createTaskOpen, setCreateTaskOpen,
  };

  if (loadError && !state.loaded) {
    return <div className="flex h-screen items-center justify-center p-6 text-center text-sm"><div><p className="font-medium">The workspace didn’t load.</p><p className="mt-1 text-muted-foreground">{loadError}</p><button className="mt-3 rounded-md border px-3 py-1.5" onClick={() => void refresh()}>Try again</button></div></div>;
  }
  if (!state.loaded) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Loading workspace…</div>;
  return <Ctx.Provider value={{ state, dispatch, ui, refresh }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

/** Every write goes to the database; the local copy updates optimistically and re-syncs on failure. */
export function useActions() {
  const { state, dispatch, refresh } = useStore();
  return useMemo(() => {
    const me = state.meId;
    const fail = (what: string) => (e: { message: string }) => { toast.error(`Couldn’t ${what}: ${e.message}`); void refresh(); };
    const run = async (what: string, p: PromiseLike<{ error: { message: string } | null }>) => {
      const { error } = await p;
      if (error) fail(what)(error);
      return !error;
    };
    const log = (text: string, projectId?: string) => {
      const activity: Activity = { id: uid("a"), actorId: me, text, projectId, createdAt: new Date().toISOString() };
      dispatch({ type: "log", activity });
      void run("log activity", supabase.from("activity").insert({ id: activity.id, actor_id: me, text, project_id: projectId ?? null }));
    };
    return {
      log,
      addProject: (p: Omit<Project, "id">) => {
        const project = { ...p, id: uid("p") };
        dispatch({ type: "addProject", project });
        void run("create the project", supabase.from("projects").insert({ id: project.id, name: p.name, ...projectPatchToRow(p) })).then((ok) => ok && log(`created project “${p.name}”`, project.id));
        return project;
      },
      updateProject: (id: string, patch: Partial<Project>) => {
        dispatch({ type: "updateProject", id, patch });
        void run("update the project", supabase.from("projects").update(projectPatchToRow(patch)).eq("id", id));
      },
      addTask: (t: Partial<Task> & Pick<Task, "title" | "projectId">) => {
        const today = new Date().toISOString().slice(0, 10);
        const task: Task = {
          id: uid("t"), description: "", assigneeId: null, reporterId: me, status: "todo", priority: "medium",
          startDate: today, dueDate: today, labels: [], subtasks: [], dependsOn: [], comments: [], createdAt: new Date().toISOString(), ...t,
        };
        dispatch({ type: "addTasks", tasks: [task] });
        void run("create the task", supabase.from("tasks").insert(taskToRow(task))).then((ok) => ok && log(`added “${task.title}”`, task.projectId));
        return task;
      },
      updateTask: (id: string, patch: Partial<Task>, note?: string) => {
        dispatch({ type: "updateTask", id, patch });
        const t = state.tasks.find((x) => x.id === id);
        void run("update the task", supabase.from("tasks").update(taskPatchToRow(patch)).eq("id", id).select("id").single()).then((ok) => ok && note && t && log(`${note} “${t.title}”`, t.projectId));
      },
      deleteTask: (id: string) => {
        const t = state.tasks.find((x) => x.id === id);
        dispatch({ type: "deleteTask", id });
        void run("delete the task", supabase.from("tasks").delete().eq("id", id).select("id").single()).then((ok) => ok && t && log(`deleted “${t.title}”`, t.projectId));
      },
      readNotification: (id: string) => { dispatch({ type: "readNotification", id }); void run("update the notification", supabase.from("notifications").update({ read: true }).eq("id", id)); },
      readAll: () => { dispatch({ type: "readAll" }); void run("update notifications", supabase.from("notifications").update({ read: true }).eq("read", false)); },
    };
  }, [dispatch, refresh, state.tasks, state.meId]);
}
