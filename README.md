# NEXUS — AI Project Management Workspace

Plan projects, track tasks, and collaborate with an AI assistant in one unified workspace.

## Features

- **Project & Task Management**: Interactive boards, roadmaps, and sprint views.
- **Nexus AI Assistant**: Intelligent workspace agent to plan, execute, and track progress.
- **Team Permissions & Roles**: Granular access control backed by Supabase RLS.
- **Realtime Sync**: Live updates across all connected team members.

## Development

To run locally, you need Node.js and npm:

```sh
npm install
cp .env.example .env.local
npm run dev
```

Before starting the development server, fill in `.env.local` with your Supabase
project URL and publishable key. Use the same values for the `VITE_SUPABASE_*`
browser settings and the corresponding `SUPABASE_*` server settings. The template
also lists server admin, cron, and optional voice service settings.

`.env.local` is ignored by Git. Keep private credentials in server-only variables;
every `VITE_*` value is exposed to the browser. Configure the same required variables
in your hosting environment when deploying, and restart the dev server after edits.

## Built With

- TanStack Start & React 19
- TypeScript
- Tailwind CSS
- Supabase

### Beacon integration

Open **Beacon → Add Beacon project** as a Nexus admin. Paste the project endpoint
and API key from hosted Beacon's **External app API** panel, select any additional
teammates allowed to view it, and click **Test connection & save**. Admins always
have access. The server verifies the project, issues and statuses before saving;
failed checks leave the existing connection unchanged. Leave the key blank to
keep it when editing access, or enter a replacement to rotate it. Changing the
project endpoint requires a new key.

Connect as many projects as needed. Each project has its own encrypted key and
teammate access list. Use the **Beacon project** dropdown to switch between projects,
and **Edit project** to update only the selected connection. Duplicate endpoints
are rejected rather than replacing a connection. Search, filters and pagination
reset when switching projects. Only projects accessible through RLS are listed.

Database/server setup (including upgrades from the single-project version):

1. Apply `supabase/migrations/20261110180000_beacon_projects.sql` to the same
   Supabase project configured by `SUPABASE_URL`. This creates the plural
   `beacon_connections` table and preserves an existing single-project connection.
   It also works for a fresh installation. The setup dialog can copy this
   SQL for pasting into that project's SQL Editor. Alternatively, set `DATABASE_URL`
   in `.env.local` to that Supabase project's PostgreSQL connection string and run
   `npm run setup:beacon`. This verifies the database, applies the migration in a
   transaction and checks that RLS and all three access policies are present.
2. Set `BEACON_ENCRYPTION_KEY` to a stable 32-byte hex secret on the server
   (`openssl rand -hex 32`). Local development has this configured in the ignored
   `.env.local`. Set the same secret on all deployment instances and keep it
   backed up. If it changes, admins must re-enter the saved Beacon key.

Keys are encrypted with AES-256-GCM before database writes. RLS restricts reads
of encrypted settings to admins and selected viewers; only admins can save.
Server functions use the signed-in user's database client, check `user_roles`
for configuration changes, and never return saved keys. The endpoint is restricted
to `https://beacon-a5phantom.vercel.app/api/v1/projects/PROJECT_ID`; requests reject
redirects and time out after 15 seconds. No service-role key is needed for Beacon.

Beacon remains the source of truth. This integration reads live issues with search,
status filters and pagination, linking to Beacon for editing. It does not copy
issues into Nexus tasks or totals. Use a read-only Beacon key. Keys expire after
90 days and may be revoked in Beacon.

Legacy server-only `BEACON_ENDPOINT`, `BEACON_PROJECT_KEY` and
`BEACON_ALLOWED_USER_IDS` settings remain supported when no database connection
is visible to the user. Remove these legacy variables when switching fully to
the admin form.

Verify with an admin and a selected teammate at `/beacon`. Other users must not
receive project data or saved keys. Members/managers must not be able to save
settings, even by invoking the server function directly. Logged-out visitors
are redirected to `/auth`.
