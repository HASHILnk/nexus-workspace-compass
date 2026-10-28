import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/nexus/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: location.pathname } });
  },
  component: () => (
    <StoreProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </StoreProvider>
  ),
});
