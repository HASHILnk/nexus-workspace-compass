import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { memberById, projectById } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { MemberAvatar, PageHeader, Panel } from "@/components/nexus/bits";

export const Route = createFileRoute("/_authenticated/documents")({
  head: pageHead("Documents", "Specs, briefs and plans linked to your projects."),
  component: DocsPage,
});

function DocsPage() {
  const { state } = useStore();
  return (
    <div>
      <PageHeader
        title="Documents"
        actions={
          <Button size="sm" onClick={() => toast.info("Document editing is coming soon.")}>
            <Plus className="size-4" />
            New document
          </Button>
        }
      />
      <Panel>
        {state.docs.map((d) => {
          const p = projectById(state, d.projectId);
          return (
            <div key={d.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{d.title}</p>
                {p && (
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {p.name}
                  </Link>
                )}
              </div>
              <MemberAvatar member={memberById(state, d.authorId)} />
              <span className="w-28 text-right text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
              </span>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
