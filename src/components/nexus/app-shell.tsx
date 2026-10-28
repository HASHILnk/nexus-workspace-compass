import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, Bot, Calendar, ChevronsUpDown, FileText, FolderKanban, GanttChart, LayoutGrid, ListChecks, Menu, PanelLeftClose, PanelLeftOpen, PanelRightOpen, Plus, Search, Settings, Star, Clock, Users, BarChart3, LogOut, Hexagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL } from "@/lib/permissions";
import { useActions, useStore } from "@/lib/store";
import { memberById } from "@/lib/selectors";
import { MemberAvatar, colorClass } from "./bits";
import { AiPanel } from "./ai-panel";
import { TaskDrawer } from "./task-drawer";
import { CreateProjectDialog, CreateTaskDialog } from "./dialogs";
import { AiConfigHeaderButton, AiConfigDialog } from "./ai-config-dialog";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/tasks", label: "My Tasks", icon: ListChecks },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/team", label: "Team", icon: Users },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/timeline", label: "Timeline", icon: GanttChart },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "/ai", label: "AI Assistant", icon: Bot },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { state, ui } = useStore();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const me = memberById(state, state.meId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => { await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); void navigate({ to: "/auth", search: { redirect: undefined }, replace: true }); };
  const unread = state.notifications.filter((n) => !n.read).length;
  const favs = state.projects.slice(0, 3);
  const recent = state.projects.slice(3, 6);
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-2 px-3 pb-2 pt-3", collapsed && "justify-center px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 text-left hover:bg-sidebar-accent", collapsed && "flex-none")}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar"><Hexagon className="size-4" /></span>
            {!collapsed && <><span className="min-w-0 flex-1"><span className="block text-sm font-bold tracking-tight">NEXUS</span><span className="block truncate text-[11px] text-sidebar-foreground/60">Acme Inc. workspace</span></span><ChevronsUpDown className="size-3.5 text-muted-foreground" /></>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56"><DropdownMenuLabel>Workspaces</DropdownMenuLabel><DropdownMenuItem>Acme Inc. ✓</DropdownMenuItem><DropdownMenuItem onClick={() => toast.info("Multiple workspaces are coming soon.")}>+ Create workspace</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={cn("px-3 pb-2", collapsed && "px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" className={cn("w-full", collapsed && "size-9 p-0")} aria-label="New"><Plus className="size-4" />{!collapsed && "New"}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => ui.setCreateTaskOpen({})}><ListChecks className="size-4" />New task</DropdownMenuItem>
            <DropdownMenuItem onClick={() => ui.setCreateProjectOpen(true)}><FolderKanban className="size-4" />New project</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Document editing is coming soon.")}><FileText className="size-4" />New document</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3" aria-label="Main">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} onClick={onNavigate} title={collapsed ? n.label : undefined}
            className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground", isActive(n.to) && "bg-sidebar-accent font-semibold text-sidebar-foreground", collapsed && "justify-center px-0")}>
            <n.icon className={cn("size-4 shrink-0", isActive(n.to) && "text-sidebar-primary")} />
            {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
            {!collapsed && n.to === "/notifications" && unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{unread}</span>}
          </Link>
        ))}
        {!collapsed && ([{ label: "Favorites", list: favs, Icon: Star }, { label: "Recent Projects", list: recent, Icon: Clock }]).map(({ label, list, Icon }) => (
          <div key={label} className="pt-4">
            <p className="flex items-center gap-1.5 px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50"><Icon className="size-3" />{label}</p>
            {list.map((p) => (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }} onClick={onNavigate} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground", path === `/projects/${p.id}` && "bg-sidebar-accent text-sidebar-foreground")}>
                <span className={cn("size-2 rounded-sm", colorClass(p.color))} /><span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className={cn("flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-sidebar-accent", collapsed && "justify-center")}>
            <MemberAvatar member={me} size="md" />
            {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{me?.name}</span><span className="block truncate text-[11px] text-sidebar-foreground/60">{me?.role} · {state.myRole ? ROLE_LABEL[state.myRole] : "Member"}</span></span>}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem asChild><Link to="/settings"><Settings className="size-4" />Settings</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}><LogOut className="size-4" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function GlobalSearch({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { state, ui } = useStore();
  const navigate = useNavigate();
  const go = (fn: () => void) => { setOpen(false); fn(); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, tasks, people, docs…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Projects">{state.projects.map((p) => <CommandItem key={p.id} value={`project ${p.name}`} onSelect={() => go(() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } }))}><span className={cn("size-2 rounded-sm", colorClass(p.color))} />{p.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Tasks">{state.tasks.map((t) => <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => go(() => ui.setOpenTaskId(t.id))}><ListChecks className="size-4" />{t.title}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="People">{state.members.map((m) => <CommandItem key={m.id} value={`person ${m.name}`} onSelect={() => go(() => navigate({ to: "/team" }))}><MemberAvatar member={m} size="xs" />{m.name}<span className="ml-auto text-xs text-muted-foreground">{m.role}</span></CommandItem>)}</CommandGroup>
        <CommandGroup heading="Documents">{state.docs.map((d) => <CommandItem key={d.id} value={`doc ${d.title}`} onSelect={() => go(() => navigate({ to: "/documents" }))}><FileText className="size-4" />{d.title}</CommandItem>)}</CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function NotificationBell() {
  const { state } = useStore();
  const { readNotification, readAll } = useActions();
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-9" aria-label={`Notifications, ${unread} unread`}><Bell className="size-4" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{unread}</span>}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-semibold">Notifications</span><button className="text-xs text-primary hover:underline" onClick={readAll}>Mark all read</button></div>
        <div className="max-h-80 overflow-y-auto">{state.notifications.map((n) => (
          <button key={n.id} onClick={() => readNotification(n.id)} className="flex w-full gap-2.5 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/50">
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
            <span><span className={cn("block text-xs", !n.read && "font-medium")}>{n.text}</span><span className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span></span>
          </button>))}</div>
        <Link to="/notifications" className="block border-t px-3 py-2 text-center text-xs text-muted-foreground hover:text-foreground">View all</Link>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ui } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [mobileAi, setMobileAi] = useState(false);
  const [search, setSearch] = useState(false);
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const f = () => setWide(mq.matches); f();
    mq.addEventListener("change", f);
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); } };
    window.addEventListener("keydown", k);
    return () => { mq.removeEventListener("change", f); window.removeEventListener("keydown", k); };
  }, []);
  // On narrow screens, AI requests open the drawer
  useEffect(() => { if (!wide && ui.aiPrompt) setMobileAi(true); }, [ui.aiPrompt, wide]);

  const showAiDock = wide && ui.aiOpen;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className={cn("hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:block", collapsed ? "w-[60px]" : "w-[245px]")}>
        <SidebarNav collapsed={collapsed} />
      </aside>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[260px] bg-sidebar p-0 text-sidebar-foreground"><SheetTitle className="sr-only">Navigation</SheetTitle><SidebarNav collapsed={false} onNavigate={() => setMobileNav(false)} /></SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur md:px-5">
          <Button variant="ghost" size="icon" className="size-8 md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu className="size-4" /></Button>
          <Button variant="ghost" size="icon" className="hidden size-8 md:inline-flex" aria-label="Toggle sidebar" onClick={() => setCollapsed((c) => !c)}>{collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</Button>
          <button onClick={() => setSearch(true)} className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-full border bg-muted/60 px-4 text-sm text-muted-foreground transition-colors hover:border-ring/40 hover:bg-card">
            <Search className="size-4" /><span className="flex-1 text-left">Search projects, tasks, people…</span><kbd className="hidden rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <AiConfigHeaderButton />
            <NotificationBell />
            {(!showAiDock) && <Button variant="outline" size="sm" className="h-9" onClick={() => (wide ? ui.setAiOpen(true) : setMobileAi(true))}><Bot className="size-4 text-primary" /><span className="hidden sm:inline">Nexus AI</span></Button>}
            {showAiDock && <Button variant="ghost" size="icon" className="size-9" aria-label="Hide assistant" onClick={() => ui.setAiOpen(false)}><PanelRightOpen className="size-4" /></Button>}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto"><div className="mx-auto max-w-[1280px] px-4 py-7 md:px-8">{children}</div></main>
      </div>

      {showAiDock && <div className="w-[340px] shrink-0 border-l"><AiPanel /></div>}
      <Sheet open={!wide && mobileAi} onOpenChange={setMobileAi}>
        <SheetContent className="w-full p-0 sm:max-w-md [&>button]:hidden"><SheetTitle className="sr-only">Nexus AI</SheetTitle><AiPanel onClose={() => setMobileAi(false)} /></SheetContent>
      </Sheet>

      <GlobalSearch open={search} setOpen={setSearch} />
      <TaskDrawer />
      <CreateProjectDialog />
      <CreateTaskDialog />
      <AiConfigDialog />
    </div>
  );
}
