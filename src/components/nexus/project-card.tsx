import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { memberById, projectStats } from "@/lib/selectors";
import type { Project } from "@/lib/types";
import { AvatarStack, Bar, HealthBadge, ProjectStatusPill, colorClass } from "./bits";
import { cn } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  const { state } = useStore();
  const s = projectStats(project, state.tasks);
  const members = project.memberIds.map((id) => memberById(state, id)!).filter(Boolean);
  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }} className="group flex flex-col rounded-2xl border bg-card card-hover p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-primary-foreground", colorClass(project.color))}>{project.name[0]}</span>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="truncate text-xs text-muted-foreground">by {memberById(state, project.ownerId)?.name}</p></div>
        </div>
        <ProjectStatusPill status={project.status} />
      </div>
      <p className="mt-3 line-clamp-2 min-h-8 text-xs text-muted-foreground">{project.description}</p>
      <div className="mt-4 flex items-baseline justify-between"><span className="text-lg font-semibold tabular-nums">{s.progress}%</span><span className="text-xs text-muted-foreground">{s.done}/{s.total} tasks</span></div>
      <Bar value={s.progress} tone={project.color} className="mt-1.5" />
      <div className="mt-4 flex items-center justify-between">
        <AvatarStack members={members} />
        <HealthBadge value={s.health} />
      </div>
      <p className="mt-3 border-t pt-2.5 text-[11px] text-muted-foreground">{format(parseISO(project.startDate), "MMM d")} → <span className="font-medium text-foreground">{format(parseISO(project.deadline), "MMM d, yyyy")}</span></p>
    </Link>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const { state } = useStore();
  const s = projectStats(project, state.tasks);
  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-4 py-3 last:border-0 hover:bg-muted/40 md:grid-cols-[2fr_1fr_140px_100px_110px]">
      <span className="flex min-w-0 items-center gap-2.5"><span className={cn("size-2.5 shrink-0 rounded-sm", colorClass(project.color))} /><span className="truncate text-sm font-medium">{project.name}</span></span>
      <span className="hidden md:block"><AvatarStack members={project.memberIds.map((id) => memberById(state, id)!).filter(Boolean)} /></span>
      <span className="hidden items-center gap-2 md:flex"><Bar value={s.progress} tone={project.color} /><span className="w-9 text-xs tabular-nums text-muted-foreground">{s.progress}%</span></span>
      <span className="hidden md:block"><HealthBadge value={s.health} /></span>
      <ProjectStatusPill status={project.status} />
    </Link>
  );
}
