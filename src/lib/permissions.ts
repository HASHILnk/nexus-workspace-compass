// Workspace permission rules. The database enforces the same rules (row-level
// security); these helpers let the UI and the AI explain them before trying.
import type { Role } from "./db-map";

export const canManage = (role: Role | null | undefined) => role === "admin" || role === "manager";

/** Managers/admins may assign anyone; members may only create work for themselves (or leave it unassigned). */
export const canAssignTo = (
  role: Role | null | undefined,
  meId: string | null,
  assigneeId: string | null | undefined,
) => canManage(role) || assigneeId == null || assigneeId === meId;

/** Managers/admins edit any task; members edit tasks assigned to or reported by them. */
export const canEditTask = (
  role: Role | null | undefined,
  meId: string | null,
  t: { assigneeId: string | null; reporterId: string },
) => canManage(role) || (!!meId && (t.assigneeId === meId || t.reporterId === meId));

/** Changes touching more than one task, or any deletion, must be confirmed by the user first. */
export const requiresConfirmation = (taskCount: number, deletes = false) =>
  deletes || taskCount > 1;

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Project manager",
  member: "Member",
};
