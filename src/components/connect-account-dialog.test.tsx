import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectAccountDialog } from "@/components/connect-account-dialog";

const mocks = vi.hoisted(() => ({ rememberAccount: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/account-storage", () => ({ rememberAccount: mocks.rememberAccount }));

describe("ConnectAccountDialog", () => {
  beforeEach(() => {
    mocks.rememberAccount.mockReset();
    mocks.replace.mockReset();
    vi.restoreAllMocks();
  });

  it("omits attribution and submits a username with Enter", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ leagues: [{ id: "L1" }], username: "TimBlazing" }),
      ok: true,
    }));

    render(<ConnectAccountDialog />);

    expect(screen.queryByText(/Values via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/League data via/i)).not.toBeInTheDocument();

    const input = screen.getByLabelText("Sleeper username");
    await user.type(input, "TimBlazing{Enter}");

    expect(fetch).toHaveBeenCalledWith("/api/leagues?username=TimBlazing");
    expect(mocks.rememberAccount).toHaveBeenCalledWith({ leagueId: "L1", username: "TimBlazing" });
    expect(mocks.replace).toHaveBeenCalledWith("/L1?username=TimBlazing");
  });
});
