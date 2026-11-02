import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AiWorkspaceView } from "@/components/nexus/ai-workspace-view";

export const Route = createFileRoute("/_authenticated/ai/")({
  head: pageHead("AI Assistant", "Plan projects, find overdue work and summarize progress by chatting with Nexus AI."),
  component: () => <AiWorkspaceView />,
});
