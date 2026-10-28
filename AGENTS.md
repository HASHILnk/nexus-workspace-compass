## Architecture
- Workspace data lives in the Cloud database; `src/lib/store.tsx` loads it, subscribes to realtime changes and writes through the database, so pages never show unsaved state. Derived numbers come from `src/lib/selectors.ts` so dashboard, project and report figures stay consistent.
- Roles live only in `public.user_roles` and are enforced by RLS plus `src/lib/permissions.ts`; never trust client-side role claims.
- Nexus AI runs server-side (`src/lib/ai/agent.server.ts` via `/api/chat`) with tools that read and write the database as the signed-in user; single changes save directly, bulk changes and project plans become pending proposals confirmed in chat, and every AI action is written to `ai_actions` as the audit trail.
- All workspace pages sit under the `_authenticated` layout; `/auth` is the only public page.
