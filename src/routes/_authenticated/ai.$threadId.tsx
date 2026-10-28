import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AiPanel } from "@/components/nexus/ai-panel";

export const Route = createFileRoute("/_authenticated/ai/$threadId")({
  head: pageHead("Conversation", "A saved Nexus AI conversation about your workspace."),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return (
    <div className="mx-auto h-[calc(100vh-7.5rem)] max-w-3xl overflow-hidden rounded-xl border shadow-card">
      <AiPanel routeThreadId={threadId} />
    </div>
  );
}
