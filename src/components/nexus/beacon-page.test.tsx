import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
import { Route } from "@/routes/_authenticated/beacon";
const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/beacon.functions", () => ({
  listBeaconConnections: mocks.list,
  getBeacon: mocks.get,
}));
vi.mock("@/components/nexus/beacon-config-dialog", () => ({ BeaconConfigDialog: () => null }));
vi.mock("@/lib/store", () => ({ useStore: () => ({ state: { meId: "user", myRole: "member" } }) }));
vi.mock("@/components/nexus/bits", () => ({
  Panel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHeader: ({ title, actions }: { title: string; actions: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
function mount() {
  const Page = Route.options.component as ComponentType;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Page />
    </QueryClientProvider>,
  );
}
it("switches projects without carrying over issue data, search, status or pagination", async () => {
  mocks.list.mockResolvedValue([
    {
      id: first,
      name: "First project",
      endpoint: "https://beacon-a5phantom.vercel.app/api/v1/projects/first",
    },
    {
      id: second,
      name: "Second project",
      endpoint: "https://beacon-a5phantom.vercel.app/api/v1/projects/second",
    },
  ]);
  mocks.get.mockImplementation(async ({ data }: { data: { connectionId: string } }) => {
    const name = data.connectionId === first ? "First" : "Second";
    return {
      project: {
        key: name,
        name: `${name} project`,
        description: null,
        _count: { issues: 1, members: 1 },
      },
      issues: {
        items: [
          {
            id: name,
            number: 1,
            title: `${name} issue`,
            status: "OPEN",
            priority: "LOW",
            severity: "UI",
            assignee: null,
          },
        ],
        nextCursor: "next",
      },
      statuses: { allowedTransitions: { OPEN: ["CLOSED"] }, custom: [] },
      projectUrl: "https://beacon-a5phantom.vercel.app/projects/" + name,
    };
  });
  mount();
  await screen.findByRole("heading", { name: "First project" });
  fireEvent.change(screen.getByLabelText("Search Beacon issues"), {
    target: { value: "old search" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  fireEvent.change(await screen.findByLabelText("Filter by status"), { target: { value: "OPEN" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Page 2 · 1 issues");
  fireEvent.change(screen.getByLabelText("Beacon project"), { target: { value: second } });
  await screen.findByRole("heading", { name: "Second project" });
  expect(screen.queryByRole("link", { name: /First issue/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Search Beacon issues")).toHaveValue("");
  expect(screen.getByLabelText("Filter by status")).toHaveValue("");
  expect(screen.getByText("Page 1 · 1 issues")).toBeInTheDocument();
  expect(mocks.get).toHaveBeenLastCalledWith({
    data: { connectionId: second, query: "", status: "", cursor: undefined },
  });
});
it("does not fetch any project when none is shared with the user", async () => {
  mocks.list.mockResolvedValue([]);
  mount();
  await screen.findByText("No Beacon projects have been shared with your account yet.");
  expect(mocks.get).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Add Beacon project" })).not.toBeInTheDocument();
});
