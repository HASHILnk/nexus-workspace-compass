import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BeaconConfigDialog } from "./beacon-config-dialog";
const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/beacon.functions", () => ({
  getBeaconSettings: mocks.get,
  saveBeaconSettings: mocks.save,
}));
vi.mock("@/lib/store", () => ({
  useStore: () => ({
    state: {
      meId: "admin",
      roles: {},
      members: [{ id: "member", name: "Teammate", userId: "11111111-1111-4111-8111-111111111111" }],
    },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());
const endpoint = "https://beacon-a5phantom.vercel.app/api/v1/projects/project1";
function mount(connectionId?: string) {
  const onSaved = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <BeaconConfigDialog connectionId={connectionId} onClose={vi.fn()} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return onSaved;
}
it("sends a new connection and selected teammate only when submitted", async () => {
  mocks.get.mockResolvedValue(null);
  mocks.save.mockResolvedValue({
    projectName: "Project",
    connectionId: "22222222-2222-4222-8222-222222222222",
  });
  const onSaved = mount();
  fireEvent.change(await screen.findByLabelText("Project endpoint"), {
    target: { value: endpoint },
  });
  const keyInput = screen.getByLabelText("Project API key");
  expect(keyInput).toHaveAttribute("type", "password");
  fireEvent.change(keyInput, { target: { value: "bcn_" + "a".repeat(64) } });
  fireEvent.click(screen.getByLabelText("Teammate"));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Test connection & save" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(mocks.save).toHaveBeenCalledWith({
    data: {
      endpoint,
      key: "bcn_" + "a".repeat(64),
      allowedUserIds: ["11111111-1111-4111-8111-111111111111"],
    },
  });
});
it("keeps the saved key blank and shows a failed connection without closing", async () => {
  mocks.get.mockResolvedValue({
    endpoint,
    hasKey: true,
    allowedUserIds: [],
    updatedAt: "2026-11-10",
  });
  mocks.save.mockRejectedValue(new Error("Beacon denied access."));
  const onSaved = mount();
  expect(await screen.findByLabelText("Project API key")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Test connection & save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Beacon denied access.");
  expect(onSaved).not.toHaveBeenCalled();
});

it("edits only the selected connection and retains its saved key", async () => {
  const id = "22222222-2222-4222-8222-222222222222";
  mocks.get.mockResolvedValue({
    id,
    endpoint,
    hasKey: true,
    allowedUserIds: [],
    updatedAt: "2026-11-10",
  });
  mocks.save.mockResolvedValue({ projectName: "Project", connectionId: id });
  const onSaved = mount(id);
  expect(await screen.findByLabelText("Project endpoint")).toHaveValue(endpoint);
  expect(mocks.get).toHaveBeenCalledWith({ data: { id } });
  fireEvent.click(screen.getByLabelText("Teammate"));
  fireEvent.click(screen.getByRole("button", { name: "Test connection & save" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(id));
  expect(mocks.save).toHaveBeenCalledWith({
    data: { id, endpoint, key: "", allowedUserIds: ["11111111-1111-4111-8111-111111111111"] },
  });
});
