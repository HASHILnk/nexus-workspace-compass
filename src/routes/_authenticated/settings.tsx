import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAiActions } from "@/lib/ai.functions";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Role } from "@/lib/db-map";
import { memberById } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { MemberAvatar, PageHeader, Panel } from "@/components/nexus/bits";

export const Route = createFileRoute("/_authenticated/settings")({
  head: pageHead("Settings", "Profile, workspace, notifications, appearance and AI preferences."),
  component: SettingsPage,
});

function Toggle({
  label,
  hint,
  defaultChecked,
  onChange,
}: {
  label: string;
  hint?: string;
  defaultChecked?: boolean | undefined;
  onChange?: ((v: boolean) => void) | undefined;
}) {
  return (
    <label className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-0">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch defaultChecked={!!defaultChecked} onCheckedChange={(v) => onChange?.(v)} />
    </label>
  );
}

function SettingsPage() {
  const { state, refresh } = useStore();
  const me = state.members.find((m) => m.id === state.meId);
  const isAdmin = state.myRole === "admin";
  const [dark, setDark] = useState(false);
  const [name, setName] = useState(me?.name ?? "");
  const [title, setTitle] = useState(me?.role ?? "");
  const [avail, setAvail] = useState(me?.availability ?? "available");
  useEffect(() => {
    setDark(localStorage.getItem("nexus-theme") === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("nexus-theme", dark ? "dark" : "light");
  }, [dark]);

  const saveProfile = async () => {
    if (!me) return;
    const n = name.trim() || me.name;
    const initials = n
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const { error } = await supabase
      .from("members")
      .update({ name: n, role: title.trim() || me.role, availability: avail, initials })
      .eq("id", me.id)
      .select("id")
      .single();
    if (error) toast.error(`Couldn’t save: ${error.message}`);
    else {
      toast.success("Profile saved");
      await refresh();
    }
  };
  const setRole = async (userId: string, role: Role) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role })
      .eq("user_id", userId)
      .select("id")
      .single();
    if (error) toast.error(`Couldn’t change role: ${error.message}`);
    else {
      toast.success("Role updated");
      await refresh();
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 flex-wrap">
          {["profile", "team", "notifications", "appearance", "ai"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t === "ai" ? "AI & audit" : t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          <Panel title="Profile">
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <MemberAvatar member={me} size="lg" />
                <div>
                  <p className="font-medium">{me?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {me?.email} · {state.myRole ? ROLE_LABEL[state.myRole] : "No role"}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pname">Name</Label>
                  <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ptitle">Job title</Label>
                  <Input id="ptitle" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Availability</Label>
                  <Select value={avail} onValueChange={(v) => setAvail(v as typeof avail)}>
                    <SelectTrigger aria-label="Availability">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="away">Away</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={() => void saveProfile()}>
                Save
              </Button>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="team">
          <Panel title="Members & roles">
            {!isAdmin && (
              <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                Only admins can change roles.
              </p>
            )}
            {state.members.map((m) => {
              const role = m.userId ? state.roles[m.userId] : undefined;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0"
                >
                  <MemberAvatar member={m} />
                  <span className="flex-1 text-sm">
                    {m.name}
                    <span className="block text-[11px] text-muted-foreground">
                      {m.role}
                      {m.email ? ` · ${m.email}` : ""}
                    </span>
                  </span>
                  {!m.userId ? (
                    <span className="text-xs text-muted-foreground">No account yet</span>
                  ) : isAdmin && m.userId && m.id !== state.meId ? (
                    <Select
                      value={role ?? "member"}
                      onValueChange={(v) => void setRole(m.userId!, v as Role)}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Role for ${m.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["admin", "manager", "member"] as Role[]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {role ? ROLE_LABEL[role] : "Member"}
                    </span>
                  )}
                </div>
              );
            })}
          </Panel>
        </TabsContent>
        <TabsContent value="notifications">
          <Panel title="Notify me about">
            <Toggle label="Task assignments" defaultChecked />
            <Toggle label="Mentions" defaultChecked />
            <Toggle label="Comments on my tasks" defaultChecked />
            <Toggle label="Deadline reminders" hint="24 hours before due" defaultChecked />
            <Toggle label="Project updates" />
          </Panel>
        </TabsContent>
        <TabsContent value="appearance">
          <Panel title="Appearance">
            <label className="flex items-center justify-between px-4 py-3">
              <span>
                <span className="block text-sm font-medium">Dark mode</span>
                <span className="text-xs text-muted-foreground">Light is the default</span>
              </span>
              <Switch checked={dark} onCheckedChange={setDark} />
            </label>
          </Panel>
        </TabsContent>
        <TabsContent value="ai">
          <AuditLog isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditLog({ isAdmin }: { isAdmin: boolean }) {
  const { state } = useStore();
  const list = useServerFn(listAiActions);
  const q = useQuery({ queryKey: ["ai-actions"], queryFn: () => list() });
  const tone: Record<string, string> = {
    executed: "text-success",
    applied: "text-success",
    failed: "text-destructive",
    pending: "text-warning",
    rejected: "text-muted-foreground",
  };
  return (
    <Panel
      title={isAdmin ? "Nexus AI audit trail (everyone)" : "Nexus AI audit trail (your actions)"}
    >
      <p className="border-b px-4 py-2 text-xs text-muted-foreground">
        Every change Nexus AI made, attempted or proposed. Single changes save directly; bulk
        changes and new projects wait for confirmation.
      </p>
      {q.isLoading && <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>}
      {q.error && (
        <p className="px-4 py-3 text-sm text-destructive">{(q.error as Error).message}</p>
      )}
      {q.data?.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted-foreground">No AI actions yet.</p>
      )}
      {q.data?.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 border-b px-4 py-2.5 text-sm last:border-0"
        >
          <span className={`w-16 shrink-0 text-xs font-medium capitalize ${tone[a.status] ?? ""}`}>
            {a.status}
          </span>
          <span className="min-w-0 flex-1">
            {a.summary}
            <span className="block text-[11px] text-muted-foreground">
              {state.members.find((m) => m.id === a.member_id)?.name ?? "Unknown"} ·{" "}
              {a.tool.replace(/_/g, " ")} ·{" "}
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
            </span>
          </span>
        </div>
      ))}
    </Panel>
  );
}
