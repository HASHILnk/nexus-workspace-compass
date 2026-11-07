import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { addDays, format, formatISO } from "date-fns";
import { Bot } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { isOverdue, projectStats } from "@/lib/selectors";
import { pageHead } from "@/lib/head";
import { PRIORITIES, STATUSES } from "@/lib/types";
import { PageHeader, Panel } from "@/components/nexus/bits";

export const Route = createFileRoute("/_authenticated/reports")({
  head: pageHead(
    "Reports & Analytics",
    "Completion trends, workload, status and project health across the workspace.",
  ),
  component: Reports,
});

const C = [
  "var(--muted-foreground)",
  "var(--chart-1)",
  "var(--primary)",
  "var(--warning)",
  "var(--success)",
];
const axis = { fontSize: 11, tickLine: false, axisLine: false } as const;

function Reports() {
  const { state, ui } = useStore();
  const [proj, setProj] = useState("all");
  const [who, setWho] = useState("all");
  const [range, setRange] = useState("28");
  const tasks = state.tasks.filter(
    (t) => (proj === "all" || t.projectId === proj) && (who === "all" || t.assigneeId === who),
  );
  const n = Number(range);

  const trend = Array.from({ length: n / 7 + 1 }).map((_, i) => {
    const end = formatISO(addDays(new Date(), -n + i * 7), { representation: "date" });
    const done = tasks.filter((t) => t.status === "done" && t.dueDate <= end).length;
    return {
      week: format(addDays(new Date(), -n + i * 7), "MMM d"),
      completed: done,
      rate: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  });
  const byStatus = STATUSES.map((s) => ({
    name: s.label,
    value: tasks.filter((t) => t.status === s.id).length,
  }));
  const byPrio = PRIORITIES.map((p) => ({
    name: p.label,
    value: tasks.filter((t) => t.priority === p.id).length,
  }));
  const workload = state.members.map((m) => ({
    name: m.name.split(" ")[0],
    open: tasks.filter((t) => t.assigneeId === m.id && t.status !== "done").length,
    overdue: tasks.filter((t) => t.assigneeId === m.id && isOverdue(t)).length,
  }));
  const progress = state.projects
    .filter((p) => proj === "all" || p.id === proj)
    .map((p) => ({ name: p.name, progress: projectStats(p, state.tasks).progress }));
  const health = ["on_track", "at_risk", "off_track"].map((h) => ({
    name: h.replace("_", " "),
    value: state.projects.filter((p) => projectStats(p, state.tasks).health === h).length,
  }));

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        actions={
          <>
            <Select value={proj} onValueChange={setProj}>
              <SelectTrigger className="h-9 w-40" aria-label="Project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {state.projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="h-9 w-36" aria-label="Member">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {state.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-9 w-32" aria-label="Date range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14">Last 2 weeks</SelectItem>
                <SelectItem value="28">Last 4 weeks</SelectItem>
                <SelectItem value="56">Last 8 weeks</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => ui.askAI("Generate sprint report")}>
              <Bot className="size-4 text-primary" />
              Ask AI to analyze
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total tasks", tasks.length],
          ["Completed", tasks.filter((t) => t.status === "done").length],
          ["Overdue", tasks.filter(isOverdue).length],
          [
            "Completion rate",
            `${tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0}%`,
          ],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4 shadow-card">
            <p className="text-xs text-muted-foreground">{l}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Completion over time">
          <div className="h-60 p-4">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="week" {...axis} />
                <YAxis {...axis} width={28} />
                <Tooltip />
                <Area
                  dataKey="completed"
                  stroke="var(--primary)"
                  fill="var(--primary-soft)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Project progress">
          <div className="h-60 p-4">
            <ResponsiveContainer>
              <BarChart data={progress} layout="vertical">
                <XAxis type="number" domain={[0, 100]} {...axis} />
                <YAxis type="category" dataKey="name" {...axis} width={120} />
                <Tooltip />
                <Bar dataKey="progress" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Tasks by status">
          <div className="h-60 p-4">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={C[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pb-4 text-xs">
            {byStatus.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1">
                <span className="size-2 rounded-sm" style={{ background: C[i] }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="Tasks by priority">
          <div className="h-60 p-4">
            <ResponsiveContainer>
              <BarChart data={byPrio}>
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} width={24} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {byPrio.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        [
                          "var(--muted-foreground)",
                          "var(--chart-1)",
                          "var(--warning)",
                          "var(--destructive)",
                        ][i]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Team workload">
          <div className="h-60 p-4">
            <ResponsiveContainer>
              <BarChart data={workload}>
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} width={24} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="open" stackId="a" fill="var(--primary)" />
                <Bar
                  dataKey="overdue"
                  stackId="a"
                  fill="var(--destructive)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Project health">
          <div className="h-60 p-4">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={health}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                  fontSize={11}
                >
                  {health.map((_, i) => (
                    <Cell
                      key={i}
                      fill={["var(--success)", "var(--warning)", "var(--destructive)"][i]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
