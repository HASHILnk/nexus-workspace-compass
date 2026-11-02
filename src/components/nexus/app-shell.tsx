import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  AudioLines, Bell, Bot, Calendar, ChevronsUpDown, FileText, FolderKanban, GanttChart, LayoutGrid, ListChecks, Menu, PanelLeftClose, PanelLeftOpen, PanelRightOpen, Plus, Search, Settings, Star, Clock, Users, BarChart3, LogOut, Hexagon,
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
import { VoiceAgent } from "./voice-agent";
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

function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { state, ui } = useStore();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const me = memberById(state, state.meId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  };
  const unread = state.notifications.filter((n) => !n.read).length;
  const favs = state.projects.slice(0, 3);
  const recent = state.projects.slice(3, 6);
  const isActive = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));

  return (
    <div className="flex h-full flex-col select-none bg-[#FAF8F5]">
      {/* Workspace Branding / Switcher */}
      <div className={cn("flex items-center gap-2 px-3 pb-2 pt-3", collapsed && "justify-center px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1.5 text-left hover:bg-[#EFECE5] transition-colors cursor-pointer",
              collapsed && "flex-none p-1"
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#111111] text-white">
              <Hexagon className="size-4 stroke-[2.5]" />
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold tracking-tight text-[#111111]">NEXUS</span>
                  <span className="block truncate text-[11px] text-[#777777]">Acme Inc. workspace</span>
                </span>
                <ChevronsUpDown className="size-3.5 text-[#888888]" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-[#FAF8F5] border border-[#E8E3D8]">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuItem>Acme Inc. ✓</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Multiple workspaces are coming soon.")}>
              + Create workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* "+ New" Action Button */}
      <div className={cn("px-3 pb-2", collapsed && "px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className={cn(
                "w-full bg-[#111111] text-white hover:bg-[#222222] text-xs font-medium h-9 rounded-lg gap-2 cursor-pointer shadow-2xs",
                collapsed && "size-9 p-0"
              )}
              aria-label="New"
            >
              <Plus className="size-4" />
              {!collapsed && <span>New</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-[#FAF8F5] border border-[#E8E3D8]">
            <DropdownMenuItem onClick={() => ui.setCreateTaskOpen({})}>
              <ListChecks className="size-4 mr-2" />New task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => ui.setCreateProjectOpen(true)}>
              <FolderKanban className="size-4 mr-2" />New project
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info("Document editing is coming soon.")}>
              <FileText className="size-4 mr-2" />New document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Nav Items */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" aria-label="Main">
        {NAV.map((n) => {
          const active = isActive(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              title={collapsed ? n.label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                active
                  ? "bg-[#EAE5D9] font-semibold text-[#111111]"
                  : "text-[#666666] hover:bg-[#F2EFE9] hover:text-[#111111]",
                collapsed && "justify-center px-0"
              )}
            >
              <n.icon className={cn("size-4 shrink-0", active ? "text-[#111111]" : "text-[#777777]")} />
              {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
              {!collapsed && n.to === "/notifications" && unread > 0 && (
                <span className="rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}

        {/* Favorites */}
        {!collapsed && favs.length > 0 && (
          <div className="pt-4">
            <p className="flex items-center gap-1.5 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#888888]">
              <Star className="size-3" />
              <span>Favorites</span>
            </p>
            {favs.map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                  path === `/projects/${p.id}`
                    ? "bg-[#F0F1F3] font-semibold text-[#111111]"
                    : "text-[#666666] hover:bg-[#F8F9FA] hover:text-[#111111]"
                )}
              >
                <span className={cn("size-2 rounded-full shrink-0", colorClass(p.color))} />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Recent Projects */}
        {!collapsed && recent.length > 0 && (
          <div className="pt-3">
            <p className="flex items-center gap-1.5 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#888888]">
              <Clock className="size-3" />
              <span>Recent Projects</span>
            </p>
            {recent.map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                  path === `/projects/${p.id}`
                    ? "bg-[#EAE5D9] font-semibold text-[#111111]"
                    : "text-[#666666] hover:bg-[#F2EFE9] hover:text-[#111111]"
                )}
              >
                <span className={cn("size-2 rounded-full shrink-0", colorClass(p.color))} />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* User Profile Footer */}
      <div className="border-t border-[#E8E3D8] p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-[#EFECE5] transition-colors cursor-pointer",
              collapsed && "justify-center"
            )}
          >
            <MemberAvatar member={me} size="md" />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-[#111111]">{me?.name}</span>
                <span className="block truncate text-[11px] text-[#777777]">
                  {me?.role} · {state.myRole ? ROLE_LABEL[state.myRole] : "Member"}
                </span>
              </span>
            )}
            {!collapsed && <ChevronsUpDown className="size-3.5 text-[#888888]" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 bg-[#FAF8F5] border border-[#E8E3D8]">
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="size-4 mr-2" />Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#E8E3D8]" />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut className="size-4 mr-2" />Sign out
            </DropdownMenuItem>
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
  const [mobileAi, setMobileAi] = useState(false);
  const [search, setSearch] = useState(false);
  const [voice, setVoice] = useState(false);
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

  const path = useRouterState({ select: (r) => r.location.pathname });
  const isAiPage = path === "/ai" || path.startsWith("/ai/");
  const showAiDock = wide && ui.aiOpen && !isAiPage;

  return (
    <div className="h-screen w-full overflow-hidden bg-white dark:bg-background p-3 sm:p-3.5 text-[#111111]">
      <div className="flex h-full w-full overflow-hidden rounded-[28px] md:rounded-[32px] border border-[#DDD7CB] dark:border-border bg-[#FAF8F5] dark:bg-card text-[#111111] font-sans antialiased shadow-[0_14px_45px_-10px_rgba(0,0,0,0.13),0_6px_18px_-2px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)]">
        {/* Persistent Left Sidebar (Desktop) */}
        <aside
          className={cn(
            "hidden md:flex flex-col h-full border-r border-[#E8E3D8] dark:border-border bg-[#FAF8F5] transition-[width,margin] duration-200 z-20 shrink-0",
            ui.sidebarOpen ? "w-[275px]" : "w-0 -ml-[275px] overflow-hidden border-none"
          )}
        >
          <SidebarNav />
        </aside>

        {/* Mobile Navigation Drawer */}
        <Sheet open={ui.mobileNav} onOpenChange={ui.setMobileNav}>
          <SheetContent side="left" className="w-[280px] max-w-[80vw] bg-[#FAF8F5] p-0 text-[#111111] border-r border-[#E8E3D8]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => ui.setMobileNav(false)} />
          </SheetContent>
        </Sheet>

        {/* Right-Hand Main Workspace Area */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#FAF8F5] dark:bg-background relative overflow-hidden">
          {isAiPage ? (
            /* AI Assistant Page occupies right content with its WorkspaceHeader and chat canvas */
            children
          ) : (
            /* Regular Workspace Pages */
            <>
              <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#E8E3D8] dark:border-border bg-[#FAF8F5] dark:bg-card px-3 md:px-5 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 md:hidden text-[#777777] hover:text-[#111111] hover:bg-[#EFECE5]"
                  aria-label="Open navigation"
                  onClick={() => ui.setMobileNav(true)}
                >
                  <Menu className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden size-8 md:inline-flex text-[#777777] hover:text-[#111111] hover:bg-[#EFECE5]"
                  aria-label="Toggle sidebar"
                  onClick={() => ui.setSidebarOpen((v) => !v)}
                >
                  {ui.sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                </Button>
                <button
                  onClick={() => setSearch(true)}
                  className="flex h-8 max-w-md flex-1 items-center gap-2 rounded-full border border-[#E8E3D8] dark:border-border bg-[#FAF8F5] dark:bg-background hover:bg-[#EFECE5] px-3.5 text-xs text-muted-foreground transition-colors cursor-pointer"
                >
                  <Search className="size-3.5" />
                  <span className="flex-1 text-left">Search projects, tasks, people…</span>
                  <kbd className="hidden rounded border border-[#E8E3D8] bg-[#FAF8F5] dark:bg-background px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <AiConfigHeaderButton />
                  <NotificationBell />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7.5 rounded-full text-xs gap-1.5 border-[#E8E3D8] dark:border-border bg-[#FAF8F5] dark:bg-card hover:bg-[#EFECE5] text-[#111111] dark:text-foreground"
                    onClick={() => setVoice(true)}
                    aria-label="Talk to Voice Assistant"
                  >
                    <AudioLines className="size-3.5 text-primary" />
                    <span className="hidden sm:inline">Voice</span>
                  </Button>
                  {!showAiDock && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7.5 rounded-full text-xs gap-1.5 border-[#E8E3D8] dark:border-border bg-[#FAF8F5] dark:bg-card hover:bg-[#EFECE5] text-[#111111] dark:text-foreground"
                      onClick={() => (wide ? ui.setAiOpen(true) : setMobileAi(true))}
                    >
                      <Bot className="size-3.5 text-primary" />
                      <span className="hidden sm:inline">Nexus AI</span>
                    </Button>
                  )}
                  {showAiDock && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-[#777777] hover:text-[#111111] hover:bg-[#EFECE5]"
                      aria-label="Hide assistant"
                      onClick={() => ui.setAiOpen(false)}
                    >
                      <PanelRightOpen className="size-4" />
                    </Button>
                  )}
                </div>
              </header>

              <main className="flex-1 overflow-y-auto bg-[#FAF8F5] dark:bg-background no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8">
                  {children}
                </div>
              </main>
            </>
          )}
        </div>

        {/* Companion AI Dock on right if opened on non-AI pages */}
        {showAiDock && (
          <div className="w-[340px] shrink-0 border-l border-[#E8E3D8] dark:border-border bg-[#FAF8F5]">
            <AiPanel />
          </div>
        )}
      </div>

      <GlobalSearch open={search} setOpen={setSearch} />
      <TaskDrawer />
      <CreateProjectDialog />
      <CreateTaskDialog />
      <AiConfigDialog />
      <VoiceAgent open={voice} onClose={() => setVoice(false)} />
    </div>
  );
}
