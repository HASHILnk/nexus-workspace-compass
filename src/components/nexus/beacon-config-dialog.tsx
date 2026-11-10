import beaconSetupSql from "../../../supabase/migrations/20261110180000_beacon_projects.sql?raw";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getBeaconSettings, saveBeaconSettings } from "@/lib/beacon.functions";
import { useStore } from "@/lib/store";

function nexusSqlEditorUrl() {
  try {
    const host = new URL(import.meta.env["VITE_SUPABASE_URL"]).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    if (match) return `https://supabase.com/dashboard/project/${match[1]}/sql/new`;
  } catch {
    /* The generic dashboard remains available for custom Supabase domains. */
  }
  return "https://supabase.com/dashboard";
}

export function BeaconConfigDialog({
  onClose,
  onSaved,
  connectionId,
}: {
  connectionId?: string | undefined;
  onClose: () => void;
  onSaved: (connectionId: string) => void;
}) {
  const { state } = useStore();
  const settings = useQuery({
    queryKey: ["beacon-settings", state.meId, connectionId],
    queryFn: () => getBeaconSettings({ data: { id: connectionId } }),
    retry: false,
    staleTime: 0,
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{connectionId ? "Edit Beacon project" : "Add Beacon project"}</DialogTitle>
          <DialogDescription>
            Connect a hosted Beacon project to Nexus. Only Nexus admins can change this connection.
          </DialogDescription>
        </DialogHeader>
        {settings.isPending ? (
          <p role="status">Loading connection settings…</p>
        ) : settings.isError ? (
          <>
            <div role="alert" className="space-y-3">
              <p className="text-sm text-destructive">{settings.error.message}</p>
              {settings.error.message.includes("database setup") && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Run this setup once in the Nexus Supabase project’s SQL Editor, then retry. Your
                    API key is not included.
                  </p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(beaconSetupSql);
                        toast.success(
                          "Setup SQL copied. Paste it into the Nexus Supabase SQL Editor and run it.",
                        );
                      } catch {
                        toast.error(
                          "Could not copy. Open supabase/migrations/20261110180000_beacon_projects.sql in the project.",
                        );
                      }
                    }}
                  >
                    Copy database setup SQL
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={nexusSqlEditorUrl()} target="_blank" rel="noopener noreferrer">
                      Open Nexus SQL Editor
                    </a>
                  </Button>
                </div>
              )}
              <Button variant="outline" onClick={() => void settings.refetch()}>
                Retry setup check
              </Button>
            </div>
            <BeaconConfigForm settings={null} onSaved={onSaved} setupRequired />
          </>
        ) : (
          <BeaconConfigForm settings={settings.data} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BeaconConfigForm({
  settings,
  onSaved,
  setupRequired = false,
}: {
  setupRequired?: boolean;
  settings: Awaited<ReturnType<typeof getBeaconSettings>>;
  onSaved: (connectionId: string) => void;
}) {
  const { state } = useStore();
  const queryClient = useQueryClient();
  const [endpoint, setEndpoint] = useState(settings?.endpoint ?? "");
  const [key, setKey] = useState("");
  const [allowedUserIds, setAllowedUserIds] = useState(settings?.allowedUserIds ?? []);
  const save = useMutation({
    mutationFn: () =>
      saveBeaconSettings({ data: { id: settings?.id, endpoint, key, allowedUserIds } }),
    onSuccess: async (result) => {
      setKey("");
      await queryClient.cancelQueries({ queryKey: ["beacon"] });
      queryClient.removeQueries({ queryKey: ["beacon"] });
      await queryClient.invalidateQueries({ queryKey: ["beacon-settings"] });
      toast.success(`Connected to ${result.projectName}`);
      await queryClient.invalidateQueries({ queryKey: ["beacon-connections"] });
      onSaved(result.connectionId);
    },
  });
  const teammates = state.members.filter(
    (member) => member.userId && state.roles[member.userId] !== "admin",
  );
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        In{" "}
        <a
          className="underline"
          href="https://beacon-a5phantom.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Beacon
        </a>
        , open your project’s <strong>External app API</strong> panel. Copy its endpoint and create
        a read-only key.
      </p>
      <fieldset disabled={save.isPending || setupRequired} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="beacon-endpoint">Project endpoint</Label>
          <Input
            id="beacon-endpoint"
            type="url"
            required
            maxLength={500}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://beacon-a5phantom.vercel.app/api/v1/projects/…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beacon-key">Project API key</Label>
          <Input
            id="beacon-key"
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            required={!settings?.hasKey || endpoint !== settings.endpoint}
            maxLength={500}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              settings?.hasKey
                ? "Saved securely · leave blank to keep current key"
                : "Paste your Beacon API key"
            }
          />
          <p className="text-xs text-muted-foreground">
            The key is encrypted before saving and is never displayed again. Nexus only reads Beacon
            data.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Who can view this project?</p>
          <p className="text-xs text-muted-foreground">
            Nexus admins always have access. Select additional teammates who are authorized to see
            this Beacon project.
          </p>
          <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
            {teammates.length ? (
              teammates.map((member) => (
                <label key={member.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowedUserIds.includes(member.userId!)}
                    onChange={(e) =>
                      setAllowedUserIds((old) =>
                        e.target.checked
                          ? [...old, member.userId!]
                          : old.filter((id) => id !== member.userId),
                      )
                    }
                  />
                  <span>
                    {member.name}
                    {member.email ? ` (${member.email})` : ""}
                  </span>
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No additional signed-in teammates yet. Access is limited to admins.
              </p>
            )}
          </div>
        </div>
      </fieldset>
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {save.error.message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={save.isPending || setupRequired}>
        {save.isPending ? "Testing and saving…" : "Test connection & save"}
      </Button>
    </form>
  );
}
