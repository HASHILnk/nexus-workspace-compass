import { afterEach, describe, expect, it, vi } from "vitest";
import { beaconEndpoint, beaconSettingsInput } from "./beacon-settings";
import { decryptBeaconKey, encryptBeaconKey } from "./beacon-crypto.server";
import { loadBeaconConnection, requireBeaconAdmin } from "./beacon-storage.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

afterEach(() => vi.unstubAllEnvs());

describe("Beacon settings", () => {
  it("allows only hosted Beacon project endpoints", () => {
    expect(
      beaconEndpoint.safeParse("https://beacon-a5phantom.vercel.app/api/v1/projects/project-1")
        .success,
    ).toBe(true);
    for (const endpoint of [
      "not a URL",
      "https://127.0.0.1/api/v1/projects/a",
      "https://other.vercel.app/api/v1/projects/a",
      "https://user:pass@beacon-a5phantom.vercel.app/api/v1/projects/a",
      "https://beacon-a5phantom.vercel.app/api/v1/projects/a?resource=notes",
      "http://beacon-a5phantom.vercel.app/api/v1/projects/a",
    ]) {
      expect(beaconEndpoint.safeParse(endpoint).success).toBe(false);
    }
  });
  it("rejects invalid keys and user IDs", () => {
    const input = {
      endpoint: "https://beacon-a5phantom.vercel.app/api/v1/projects/a",
      key: "bcn_" + "a".repeat(64),
      allowedUserIds: [],
    };
    expect(beaconSettingsInput.safeParse(input).success).toBe(true);
    expect(beaconSettingsInput.safeParse({ ...input, key: "bad-key" }).success).toBe(false);
    expect(beaconSettingsInput.safeParse({ ...input, allowedUserIds: ["admin"] }).success).toBe(
      false,
    );
    expect(beaconSettingsInput.safeParse({ ...input, role: "admin" }).success).toBe(false);
  });
});

describe("Beacon key encryption", () => {
  it("encrypts keys with a fresh nonce and detects tampering", () => {
    vi.stubEnv("BEACON_ENCRYPTION_KEY", "a".repeat(64));
    const encrypted = encryptBeaconKey("project-secret");
    expect(encrypted).not.toContain("project-secret");
    expect(encryptBeaconKey("project-secret")).not.toBe(encrypted);
    expect(decryptBeaconKey(encrypted)).toBe("project-secret");
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("0") ? "1" : "0");
    expect(() => decryptBeaconKey(tampered)).toThrow("re-enter");
  });
  it("fails closed when the encryption key changes or is missing", () => {
    vi.stubEnv("BEACON_ENCRYPTION_KEY", "a".repeat(64));
    const encrypted = encryptBeaconKey("project-secret");
    vi.stubEnv("BEACON_ENCRYPTION_KEY", "b".repeat(64));
    expect(() => decryptBeaconKey(encrypted)).toThrow("re-enter");
    vi.stubEnv("BEACON_ENCRYPTION_KEY", "");
    expect(() => encryptBeaconKey("project-secret")).toThrow("not configured");
  });
});

describe("Beacon admin authorization", () => {
  it.each(["member", "manager", null, "admin"])("checks the database role: %s", async (role) => {
    const eq = vi.fn().mockReturnValue({
      maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
    });
    const client = {
      from: vi.fn().mockReturnValue({ select: () => ({ eq }) }),
    } as unknown as SupabaseClient<Database>;
    const result = requireBeaconAdmin(client, "authenticated-user");
    if (role === "admin") await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toThrow("Only Nexus admins");
    expect(client.from).toHaveBeenCalledWith("user_roles");
    expect(eq).toHaveBeenCalledWith("user_id", "authenticated-user");
  });
});

describe("Beacon project isolation", () => {
  it("loads the key belonging to the requested connection", async () => {
    vi.stubEnv("BEACON_ENCRYPTION_KEY", "a".repeat(64));
    const rows = {
      first: {
        endpoint: "https://beacon-a5phantom.vercel.app/api/v1/projects/first",
        encrypted_key: encryptBeaconKey("first-secret"),
      },
      second: {
        endpoint: "https://beacon-a5phantom.vercel.app/api/v1/projects/second",
        encrypted_key: encryptBeaconKey("second-secret"),
      },
    };
    const eq = vi.fn((_column: string, id: keyof typeof rows) => ({
      maybeSingle: async () => ({ data: rows[id] ?? null, error: null }),
    }));
    const client = {
      from: vi.fn(() => ({ select: () => ({ eq }) })),
    } as unknown as SupabaseClient<Database>;
    expect((await loadBeaconConnection(client, "user", "first")).key).toBe("first-secret");
    expect((await loadBeaconConnection(client, "user", "second")).key).toBe("second-secret");
    expect(eq).toHaveBeenCalledWith("id", "first");
    expect(eq).toHaveBeenCalledWith("id", "second");
  });
  it("denies a missing or RLS-hidden project without falling back to another key", async () => {
    vi.stubEnv("BEACON_ENDPOINT", "https://beacon-a5phantom.vercel.app/api/v1/projects/legacy");
    vi.stubEnv("BEACON_PROJECT_KEY", "legacy-secret");
    vi.stubEnv("BEACON_ALLOWED_USER_IDS", "user");
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }),
    } as unknown as SupabaseClient<Database>;
    await expect(loadBeaconConnection(client, "user", "hidden-project")).rejects.toThrow(
      "do not have access",
    );
  });
});
