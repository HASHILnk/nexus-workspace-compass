import { z } from "zod";
import { beaconSettingsInput } from "./beacon-settings";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  beaconConfig,
  beaconFilters,
  beaconIssues,
  beaconProject,
  beaconStatuses,
  readBeacon,
} from "./beacon";

export const getBeacon = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => beaconFilters.parse(input))
  .handler(async ({ context, data }) => {
    const { loadBeaconConnection } = await import("./beacon-storage.server");
    const config = await loadBeaconConnection(context.supabase, context.userId, data.connectionId);
    const [project, issues, statuses] = await Promise.all([
      readBeacon(config, { resource: "project" }, beaconProject),
      readBeacon(
        config,
        {
          resource: "issues",
          limit: "50",
          query: data.query,
          ...(data.status ? { status: data.status } : {}),
          ...(data.cursor ? { cursor: data.cursor } : {}),
        },
        beaconIssues,
      ),
      readBeacon(config, { resource: "statuses" }, beaconStatuses),
    ]);
    return { project, issues, statuses, projectUrl: config.projectUrl };
  });

export const listBeaconConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { connectionError } = await import("./beacon-storage.server");
    const { data, error } = await context.supabase
      .from("beacon_connections")
      .select("id, project_name, endpoint")
      .order("project_name");
    if (error) connectionError(error.code);
    const connections = (data ?? []).map((row) => ({
      id: row.id,
      name: row.project_name,
      endpoint: row.endpoint,
    }));
    if (!connections.length && process.env["BEACON_ENDPOINT"]) {
      try {
        const config = beaconConfig(process.env, context.userId);
        return [
          { id: "legacy", name: "Server-configured Beacon project", endpoint: config.endpoint },
        ];
      } catch {
        /* No legacy connection is authorized for this user. */
      }
    }
    return connections;
  });

export const getBeaconSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid().optional() }).parse(input))
  .handler(async ({ context, data: input }) => {
    const { requireBeaconAdmin, connectionError } = await import("./beacon-storage.server");
    await requireBeaconAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("beacon_connections")
      .select("id, endpoint, allowed_user_ids, updated_at")
      .eq("id", input.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (error) connectionError(error.code);
    if (input.id && !data) throw new Error("This Beacon connection no longer exists.");
    return data
      ? {
          id: data.id,
          endpoint: data.endpoint,
          allowedUserIds: data.allowed_user_ids,
          updatedAt: data.updated_at,
          hasKey: true,
        }
      : null;
  });

export const saveBeaconSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => beaconSettingsInput.parse(input))
  .handler(async ({ context, data }) => {
    const { requireBeaconAdmin, connectionError } = await import("./beacon-storage.server");
    const { encryptBeaconKey, decryptBeaconKey } = await import("./beacon-crypto.server");
    await requireBeaconAdmin(context.supabase, context.userId);
    const existing = await context.supabase
      .from("beacon_connections")
      .select("endpoint, encrypted_key")
      .eq("id", data.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    if (data.id && !existing.data && !existing.error)
      throw new Error("This Beacon connection no longer exists.");
    if (existing.error) connectionError(existing.error.code);
    if (!data.key && (!existing.data || existing.data.endpoint !== data.endpoint)) {
      throw new Error("Enter an API key for this project endpoint.");
    }
    const key = data.key || decryptBeaconKey(existing.data!.encrypted_key);
    const config = beaconConfig(
      {
        BEACON_ENDPOINT: data.endpoint,
        BEACON_PROJECT_KEY: key,
        BEACON_ALLOWED_USER_IDS: context.userId,
      },
      context.userId,
    );
    // Test all resources the page needs before replacing a working connection.
    const [project] = await Promise.all([
      readBeacon(config, { resource: "project" }, beaconProject),
      readBeacon(config, { resource: "issues", limit: "1" }, beaconIssues),
      readBeacon(config, { resource: "statuses" }, beaconStatuses),
    ]);
    const row = {
      endpoint: data.endpoint,
      project_name: project.name,
      encrypted_key: encryptBeaconKey(key),
      allowed_user_ids: [...new Set(data.allowedUserIds)],
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const table = context.supabase.from("beacon_connections");
    const { data: saved, error } = data.id
      ? await table.update(row).eq("id", data.id).select("id").single()
      : await table.insert(row).select("id").single();
    if (error?.code === "23505")
      throw new Error("This Beacon project is already connected. Select it and edit its settings.");
    if (error) connectionError(error.code);
    return { projectName: project.name, connectionId: saved!.id };
  });
