import { readFile } from "node:fs/promises";
import postgres from "postgres";

let databaseUrl;
try {
  databaseUrl = new URL(process.env.DATABASE_URL ?? "");
} catch {
  console.error(
    "Set DATABASE_URL in .env.local to the Nexus Supabase PostgreSQL connection string.",
  );
  process.exit(1);
}
if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  console.error(
    "DATABASE_URL must be a PostgreSQL connection string from Nexus Supabase → Connect. A SQLite file cannot configure the Cloud database.",
  );
  process.exit(1);
}
const sql = postgres(databaseUrl.href, { max: 1, connect_timeout: 10 });
try {
  const [schema] = await sql`
    select to_regclass('public.user_roles') is not null as roles,
           to_regclass('auth.users') is not null as auth
  `;
  if (!schema?.roles || !schema?.auth) throw new Error("WRONG_DATABASE");
  const migration = await readFile(
    new URL("../supabase/migrations/20261110180000_beacon_projects.sql", import.meta.url),
    "utf8",
  );
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });
  const [result] = await sql`
    select c.relrowsecurity as rls,
           (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'beacon_connections') as policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'beacon_connections'
  `;
  if (!result?.rls || result.policies !== 3) throw new Error("VERIFY_FAILED");
  console.log(
    "Beacon table and three access policies are ready. Click Retry setup check in Nexus, then configure your project.",
  );
} catch (error) {
  if (error.message === "WRONG_DATABASE")
    console.error(
      "This is not a Nexus Supabase database: required auth/users and workspace roles are missing. No changes were made.",
    );
  else if (error.message === "VERIFY_FAILED")
    console.error(
      "The migration ran, but policy verification failed. Check the Beacon table before using it.",
    );
  else
    console.error(
      "Beacon setup failed. Check the Nexus database connection and permissions. Error code:",
      error.code || "UNKNOWN",
    );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
}
