import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, RadioTower, RefreshCw, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel } from "@/components/nexus/bits";
import { pageHead } from "@/lib/head";
import { getBeacon, listBeaconConnections } from "@/lib/beacon.functions";
import { BeaconConfigDialog } from "@/components/nexus/beacon-config-dialog";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/beacon")({
  head: pageHead("Beacon", "Live project issues from Beacon."),
  component: BeaconPage,
});

function BeaconPage() {
  const { state } = useStore();
  const [configOpen, setConfigOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [selectedId, setSelectedId] = useState("");
  const connections = useQuery({
    queryKey: ["beacon-connections", state.meId],
    queryFn: () => listBeaconConnections(),
    retry: false,
  });
  const connectionId =
    connections.data?.find((connection) => connection.id === selectedId)?.id ??
    connections.data?.[0]?.id;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const result = useQuery({
    queryKey: ["beacon", state.meId, connectionId, query, status, cursor],
    queryFn: () => getBeacon({ data: { connectionId: connectionId!, query, status, cursor } }),
    enabled: !!connectionId,
    retry: false,
    staleTime: 30000,
  });
  const data = result.data;
  const statusOptions = data
    ? [
        ...new Set([
          ...Object.keys(data.statuses.allowedTransitions),
          ...Object.values(data.statuses.allowedTransitions).flat(),
          ...data.statuses.custom.map((s) => s.key),
        ]),
      ]
    : [];
  return (
    <div className="space-y-5">
      <PageHeader
        title="Beacon"
        actions={
          <div className="flex gap-2">
            {state.myRole === "admin" && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingId(undefined);
                    setConfigOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Add Beacon project
                </Button>
                {connectionId && connectionId !== "legacy" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingId(connectionId);
                      setConfigOpen(true);
                    }}
                  >
                    <Settings className="size-4" />
                    Edit project
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={result.isFetching}
              onClick={() => {
                void connections.refetch();
                if (connectionId) void result.refetch();
              }}
            >
              <RefreshCw className={result.isFetching ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
          </div>
        }
      />
      {configOpen && state.myRole === "admin" && (
        <BeaconConfigDialog
          connectionId={editingId}
          onClose={() => setConfigOpen(false)}
          onSaved={(id) => {
            setSelectedId(id);
            setConfigOpen(false);
            setCursors([]);
            setStatus("");
            setQuery("");
            setSearch("");
          }}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Live issues from your connected Beacon projects. Open an issue in Beacon to manage it.
      </p>
      {!!connections.data?.length && (
        <div className="space-y-2">
          <label htmlFor="beacon-project" className="text-sm font-medium">
            Beacon project
          </label>
          <select
            id="beacon-project"
            className="block w-full max-w-md rounded-md border bg-background p-2 text-sm"
            value={connectionId ?? ""}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setCursors([]);
              setStatus("");
              setQuery("");
              setSearch("");
            }}
          >
            {connections.data.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name} · {connection.endpoint.split("/").at(-1)}
              </option>
            ))}
          </select>
        </div>
      )}
      {connections.isError || result.isError ? (
        <Panel>
          <div role="alert" className="space-y-3 p-6">
            <h2 className="font-semibold">Unable to load Beacon</h2>
            <p className="text-sm text-muted-foreground">
              {connections.error?.message ?? result.error?.message}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void connections.refetch();
                if (connectionId) void result.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        </Panel>
      ) : connections.isPending ? (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          Loading Beacon projects…
        </p>
      ) : !connectionId ? (
        <Panel>
          <p className="p-6 text-sm text-muted-foreground">
            {state.myRole === "admin"
              ? "No Beacon projects connected yet. Choose Add Beacon project to connect your first project."
              : "No Beacon projects have been shared with your account yet."}
          </p>
        </Panel>
      ) : result.isPending ? (
        <p role="status" className="p-6 text-sm text-muted-foreground">
          Loading Beacon project…
        </p>
      ) : (
        data && (
          <>
            <Panel>
              <div className="flex flex-wrap items-center gap-4 p-5">
                <RadioTower className="size-8 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{data.project.key}</p>
                  <h2 className="text-lg font-semibold">{data.project.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {data.project.description || "Connected to Beacon"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.project._count.issues} issues · {data.project._count.members} members
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <a href={data.projectUrl} target="_blank" rel="noopener noreferrer">
                    Open Beacon
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              </div>
            </Panel>
          </>
        )
      )}
      {data && !result.isError && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setCursors([]);
          }}
        >
          <Input
            className="max-w-sm"
            aria-label="Search Beacon issues"
            placeholder="Search issues…"
            maxLength={500}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter by status"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursors([]);
            }}
          >
            <option value="">All statuses</option>
            {[...new Set([...statusOptions, ...(status ? [status] : [])])].map((s) => (
              <option key={s} value={s}>
                {data?.statuses.custom.find((c) => c.key === s)?.label || s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      )}
      {!result.isError && data && (
        <Panel>
          {data.issues.items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {query || status
                ? "No issues match these filters."
                : "No issues in this Beacon project yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {["Issue", "Status", "Priority", "Severity", "Assignee"].map((h) => (
                      <th className="px-4 py-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.issues.items.map((issue) => (
                    <tr className="border-b last:border-0 hover:bg-muted/30" key={issue.id}>
                      <td className="min-w-64 px-4 py-3">
                        <a
                          className="font-medium hover:underline"
                          href={`${data.projectUrl}/issues/${encodeURIComponent(issue.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="mr-2 text-muted-foreground">
                            {data.project.key}-{issue.number}
                          </span>
                          {issue.title}
                          <ExternalLink className="ml-2 inline size-3" />
                          <span className="sr-only"> (opens in Beacon)</span>
                        </a>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {issue.status.replaceAll("_", " ")}
                      </td>
                      <td className="px-4 py-3">{issue.priority}</td>
                      <td className="px-4 py-3">{issue.severity}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {issue.assignee?.name || "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t p-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!cursors.length || result.isFetching}
              onClick={() => setCursors((old) => old.slice(0, -1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {cursors.length + 1} · {data.issues.items.length} issues
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!data.issues.nextCursor || result.isFetching}
              onClick={() => {
                if (data.issues.nextCursor) setCursors((old) => [...old, data.issues.nextCursor!]);
              }}
            >
              Next
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
