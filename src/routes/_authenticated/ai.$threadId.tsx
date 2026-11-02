import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AiWorkspaceView } from "@/components/nexus/ai-workspace-view";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  head: pageHead("Conversation", "A saved Nexus AI conversation about your workspace."),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <AiWorkspaceView routeThreadId={threadId} />;
}
