import { z } from "zod";
import { beaconConnectionId } from "./beacon-settings";

export const beaconFilters = z.object({
  connectionId: beaconConnectionId,
  query: z.string().max(500).default(""),
  status: z.string().max(100).default(""),
  cursor: z.string().min(1).max(100).optional(),
});

export const beaconProject = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  _count: z.object({ issues: z.number(), members: z.number() }),
});
export const beaconIssues = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      number: z.number(),
      title: z.string(),
      status: z.string(),
      priority: z.string(),
      severity: z.string(),
      assignee: z.object({ name: z.string().nullable() }).nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export const beaconStatuses = z.object({
  allowedTransitions: z.record(z.array(z.string())),
  custom: z.array(z.object({ key: z.string(), label: z.string() })),
});

// Only a trusted deployment setting chooses the destination; never accept a URL from a client.
export function beaconConfig(env: Record<string, string | undefined>, userId: string) {
  const endpoint = env["BEACON_ENDPOINT"]?.trim();
  const key = env["BEACON_PROJECT_KEY"]?.trim();
  if (!endpoint || !key)
    throw new Error(
      "Beacon is not connected yet. Ask your administrator to configure the project connection.",
    );
  if (
    !env["BEACON_ALLOWED_USER_IDS"]
      ?.split(",")
      .map((id) => id.trim())
      .includes(userId)
  ) {
    throw new Error("Your Nexus account has not been granted access to this Beacon connection.");
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("The Beacon connection URL is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/api\/v1\/projects\/[a-zA-Z0-9_-]+$/.test(url.pathname)
  ) {
    throw new Error("The Beacon connection must use an HTTPS project API endpoint.");
  }
  return {
    endpoint: url.href,
    key,
    projectUrl: `${url.origin}/projects/${url.pathname.split("/").at(-1)}`,
  };
}

export async function readBeacon<T>(
  config: ReturnType<typeof beaconConfig>,
  params: Record<string, string>,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = new URL(config.endpoint);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.key}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("Beacon could not be reached. Please try again.");
  }
  if ([401, 403].includes(response.status))
    throw new Error(
      "Beacon denied access. Ask your administrator to check the project key, expiry and permissions.",
    );
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Beacon is busy. Please retry shortly."
        : "Beacon could not load this project. Please try again.",
    );
  const body = await response.json().catch(() => null);
  const parsed = schema.safeParse(body?.success === true ? body.data : null);
  if (!parsed.success)
    throw new Error(
      "Beacon returned an unexpected response. Check that its project API is up to date.",
    );
  return parsed.data;
}
