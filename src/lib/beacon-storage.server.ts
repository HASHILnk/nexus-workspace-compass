import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { beaconConfig } from "./beacon";
import { decryptBeaconKey } from "./beacon-crypto.server";
import { beaconEndpoint } from "./beacon-settings";

type Client = SupabaseClient<Database>;
export async function requireBeaconAdmin(client: Client, userId: string) {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || data?.role !== "admin") throw new Error("Only Nexus admins can configure Beacon.");
}
export function connectionError(code?: string): never {
  if (code === "42P01" || code === "PGRST205" || code === "42703")
    throw new Error(
      "Beacon database setup is required. Run the Beacon connection migration in the Nexus Supabase SQL Editor.",
    );
  throw new Error("Could not access Beacon settings. Please try again.");
}
export async function loadBeaconConnection(client: Client, userId: string, connectionId: string) {
  if (connectionId === "legacy") return beaconConfig(process.env, userId);
  const { data, error } = await client
    .from("beacon_connections")
    .select("endpoint, encrypted_key, allowed_user_ids")
    .eq("id", connectionId)
    .maybeSingle();
  if (error) connectionError(error.code);
  if (!data) throw new Error("This Beacon project is unavailable or you do not have access.");
  // The user-scoped client and RLS authorize access before the server decrypts the key.
  return beaconConfig(
    {
      BEACON_ENDPOINT: beaconEndpoint.parse(data.endpoint),
      BEACON_PROJECT_KEY: decryptBeaconKey(data.encrypted_key),
      BEACON_ALLOWED_USER_IDS: userId,
    },
    userId,
  );
}
