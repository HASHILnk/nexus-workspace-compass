import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/head";
import { AiPanel } from "@/components/nexus/ai-panel";

export const Route = createFileRoute("/_authenticated/ai/")({
  head: pageHead("AI Assistant", "Plan projects, find overdue work and summarize progress by chatting with Nexus AI."),
  component: () => (
    <div className="mx-auto h-[calc(100vh-7.5rem)] max-w-3xl overflow-hidden rounded-xl border shadow-card">
      <AiPanel />
    </div>
  ),
});
