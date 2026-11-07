import { describe, expect, it } from "vitest";
import { canAssignTo, canEditTask, canManage, requiresConfirmation } from "@/lib/permissions";

describe("workspace permissions", () => {
  it("lets admins and project managers assign work to other people", () => {
    expect(canAssignTo("admin", "u-me", "u-rahul")).toBe(true);
    expect(canAssignTo("manager", "u-me", "u-rahul")).toBe(true);
  });

  it("stops regular members from assigning work to someone else", () => {
    expect(canAssignTo("member", "u-me", "u-rahul")).toBe(false);
    expect(canAssignTo("member", "u-me", "u-me")).toBe(true);
  });

  it("only lets members edit tasks they are assigned to or reported", () => {
    expect(canEditTask("member", "u-me", { assigneeId: "u-other", reporterId: "u-other" })).toBe(
      false,
    );
    expect(canEditTask("member", "u-me", { assigneeId: "u-me", reporterId: "u-other" })).toBe(true);
    expect(canEditTask("manager", "u-me", { assigneeId: "u-other", reporterId: "u-other" })).toBe(
      true,
    );
  });

  it("only admins and managers can create projects", () => {
    expect(canManage("member")).toBe(false);
    expect(canManage("manager")).toBe(true);
  });

  it("requires confirmation for changes to more than one task", () => {
    expect(requiresConfirmation(1)).toBe(false);
    expect(requiresConfirmation(2)).toBe(true);
    expect(requiresConfirmation(1, true)).toBe(true);
  });
});
