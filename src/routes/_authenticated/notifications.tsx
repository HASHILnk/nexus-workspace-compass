import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { AtSign, Bell, Clock, FolderKanban, MessageSquare, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActions, useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { Empty, PageHeader, Panel } from "@/components/nexus/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: pageHead("Notifications", "Assignments, mentions, comments and deadline reminders."),
  component: NotificationsPage,
});

const icons = { assignment: UserCheck, mention: AtSign, comment: MessageSquare, deadline: Clock, project: FolderKanban };

function NotificationsPage() {
  const { state } = useStore();
  const { readNotification, readAll } = useActions();
  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${state.notifications.filter((n) => !n.read).length} unread`} actions={<Button size="sm" variant="outline" onClick={readAll}>Mark all as read</Button>} />
      <Panel>
        {state.notifications.length === 0 && <Empty title="You’re all caught up" />}
        {state.notifications.map((n) => {
          const I = icons[n.kind] ?? Bell;
          return (
            <button key={n.id} onClick={() => readNotification(n.id)} className={cn("flex w-full items-center gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/40", !n.read && "bg-primary-soft/40")}>
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted"><I className="size-4 text-muted-foreground" /></span>
              <span className="flex-1"><span className={cn("block text-sm", !n.read && "font-medium")}>{n.text}</span><span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span></span>
              {!n.read && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
            </button>);
        })}
      </Panel>
    </div>
  );
}
