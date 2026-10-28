import { cn } from "@/lib/utils";
import type { Health, Member, Priority, ProjectStatus, Status } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { daysUntil } from "@/lib/selectors";

const colorBg: Record<string, string> = {
  primary: "bg-primary", "chart-1": "bg-chart-1", "chart-2": "bg-chart-2", "chart-3": "bg-chart-3", "chart-4": "bg-chart-4", "chart-5": "bg-chart-5",
};
export const colorClass = (c: string) => colorBg[c] ?? "bg-primary";

export function MemberAvatar({ member, size = "sm", className }: { member?: Member | undefined; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const s = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-11 text-sm" }[size];
  if (!member) return <span className={cn("inline-flex items-center justify-center rounded-full border border-dashed border-border bg-muted text-muted-foreground", s, className)}>?</span>;
  return (
    <span title={member.name} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-primary-foreground ring-2 ring-card", colorClass(member.color), s, className)}>
      {member.initials}
    </span>
  );
}

export function AvatarStack({ members, max = 4 }: { members: Member[]; max?: number }) {
  return (
    <div className="flex -space-x-1.5">
      {members.slice(0, max).map((m) => <MemberAvatar key={m.id} member={m} />)}
      {members.length > max && <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">+{members.length - max}</span>}
    </div>
  );
}

const statusStyle: Record<Status, string> = {
  backlog: "bg-muted text-muted-foreground",
  todo: "bg-info-soft text-chart-1",
  in_progress: "bg-primary-soft text-accent-foreground",
  in_review: "bg-warning-soft text-foreground",
  done: "bg-success-soft text-success",
};
const statusLabel: Record<Status, string> = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done" };
export function StatusPill({ status }: { status: Status }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", statusStyle[status])}><span className="size-1.5 rounded-full bg-current" />{statusLabel[status]}</span>;
}

const prioDot: Record<Priority, string> = { low: "bg-muted-foreground/50", medium: "bg-chart-1", high: "bg-warning", urgent: "bg-destructive" };
export function PriorityPill({ priority }: { priority: Priority }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs capitalize text-foreground"><span className={cn("size-2 rounded-sm", prioDot[priority])} />{priority}</span>;
}

const pStatus: Record<ProjectStatus, [string, string]> = {
  planning: ["Planning", "bg-info-soft text-chart-1"],
  in_progress: ["In Progress", "bg-primary-soft text-accent-foreground"],
  completed: ["Completed", "bg-success-soft text-success"],
  at_risk: ["At Risk", "bg-destructive-soft text-destructive"],
};
export function ProjectStatusPill({ status }: { status: ProjectStatus }) {
  const [l, c] = pStatus[status];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", c)}>{l}</span>;
}

const health: Record<Health, [string, string]> = { on_track: ["On track", "bg-success"], at_risk: ["At risk", "bg-warning"], off_track: ["Off track", "bg-destructive"] };
export function HealthBadge({ value }: { value: Health }) {
  const [l, c] = health[value];
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-2 rounded-full", c)} />{l}</span>;
}

export function Bar({ value, className, tone = "primary" }: { value: number; className?: string; tone?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-500", colorClass(tone))} style={{ width: `${value}%` }} />
    </div>
  );
}

export function DueLabel({ date, done }: { date: string; done?: boolean }) {
  const n = daysUntil(date);
  const tone = done ? "text-muted-foreground" : n < 0 ? "text-destructive font-medium" : n <= 2 ? "text-warning font-medium" : "text-muted-foreground";
  const rel = done ? "" : n < 0 ? ` · ${-n}d late` : n === 0 ? " · today" : n === 1 ? " · tomorrow" : "";
  return <span className={cn("whitespace-nowrap text-xs", tone)}>{format(parseISO(date), "MMM d")}{rel}</span>;
}

export function Panel({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card shadow-card", className)}>
      {title && <header className="flex items-center justify-between gap-2 border-b px-5 py-3.5"><h2 className="text-[15px] font-semibold">{title}</h2>{action}</header>}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="flex flex-col items-center justify-center px-6 py-12 text-center"><span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">✦</span><p className="text-sm font-semibold">{title}</p>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div>;
}
