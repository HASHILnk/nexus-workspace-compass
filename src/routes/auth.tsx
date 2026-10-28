import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hexagon } from "lucide-react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { cloudAuth } from "@/integrations/auth/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const safePath = (p: unknown) => (typeof p === "string" && p.startsWith("/") && !p.startsWith("//") ? p : "/");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in · NEXUS" },
      { name: "description", content: "Sign in to your NEXUS workspace to manage projects, tasks and Nexus AI." },
      { property: "og:title", content: "Sign in · NEXUS" },
      { property: "og:description", content: "Sign in to your NEXUS workspace to manage projects, tasks and Nexus AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const target = safePath(redirect);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: target, replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") void navigate({ to: target, replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate, target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } } });
      if (error) toast.error(error.message);
      else if (!data.session) setSent(true);
    }
    setBusy(false);
  };

  const oauth = async (provider: "google") => {
    sessionStorage.setItem("nexus-after-login", target);
    const r = await cloudAuth.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-card">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><Hexagon className="size-4" /></span>
          <div><p className="text-sm font-bold tracking-tight">NEXUS</p><p className="text-xs text-muted-foreground">{mode === "in" ? "Sign in to your workspace" : "Create your account"}</p></div>
        </div>
        {sent ? (
          <p className="text-sm">Check <b>{email}</b> for a confirmation link, then come back and sign in.</p>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-3">
              {mode === "up" && <div className="space-y-1.5"><Label htmlFor="name">Full name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>}
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
            </form>
            <div className="my-4 flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <div className="space-y-2">
              <Button type="button" variant="outline" className="w-full" onClick={() => void oauth("google")}>Continue with Google</Button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {mode === "in" ? "New here?" : "Already have an account?"}{" "}
              <button className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Create an account" : "Sign in"}</button>
            </p>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">The first person to sign up becomes the workspace admin.</p>
          </>
        )}
      </div>
    </div>
  );
}
