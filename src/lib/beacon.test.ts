import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { beaconConfig, readBeacon } from "./beacon";

const env = {
  BEACON_ENDPOINT: "https://beacon-a5phantom.vercel.app/api/v1/projects/project-1",
  BEACON_PROJECT_KEY: "test-secret",
  BEACON_ALLOWED_USER_IDS: "user-1, user-2",
};
afterEach(() => vi.unstubAllGlobals());

describe("Beacon connection authorization", () => {
  it("denies unlisted users and an empty allowlist", () => {
    expect(() => beaconConfig(env, "other-user")).toThrow("not been granted");
    expect(() => beaconConfig({ ...env, BEACON_ALLOWED_USER_IDS: "" }, "user-1")).toThrow(
      "not been granted",
    );
  });
  it("allows an explicitly authorized user and constructs a project link", () => {
    expect(beaconConfig(env, "user-2").projectUrl).toBe(
      "https://beacon-a5phantom.vercel.app/projects/project-1",
    );
  });
  it.each([
    "http://beacon.example/api/v1/projects/1",
    "https://user:password@beacon.example/api/v1/projects/1",
    "https://beacon.example/api/v1/projects/1?resource=notes",
    "https://beacon.example/api/v1/projects/1#secret",
    "https://beacon.example/api/mcp",
  ])("rejects an unsafe or non-project endpoint: %s", (endpoint) => {
    expect(() => beaconConfig({ ...env, BEACON_ENDPOINT: endpoint }, "user-1")).toThrow(
      "HTTPS project API",
    );
  });
});

describe("Beacon upstream reads", () => {
  it("sends credentials only in the header, disables caching and redirects, and strips unknown response fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { name: "Project", secret: "hidden" } }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const data = await readBeacon(
      beaconConfig(env, "user-1"),
      { resource: "project" },
      z.object({ name: z.string() }),
    );
    expect(data).toEqual({ name: "Project" });
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("test-secret");
    expect(options).toMatchObject({
      headers: { Authorization: "Bearer test-secret" },
      cache: "no-store",
      redirect: "error",
    });
  });
  it("does not expose upstream error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private details", { status: 403 })),
    );
    await expect(readBeacon(beaconConfig(env, "user-1"), {}, z.object({}))).rejects.toThrow(
      "Beacon denied access",
    );
  });
  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: {} }))),
    );
    await expect(
      readBeacon(beaconConfig(env, "user-1"), {}, z.object({ name: z.string() })),
    ).rejects.toThrow("unexpected response");
  });
  it("handles network errors without leaking connection details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private details")));
    await expect(readBeacon(beaconConfig(env, "user-1"), {}, z.object({}))).rejects.toThrow(
      "could not be reached",
    );
  });
});
