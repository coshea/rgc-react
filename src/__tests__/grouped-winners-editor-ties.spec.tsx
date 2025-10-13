import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GroupedWinnersEditor from "@/components/grouped-winners-editor";
import type { WinnerGroup } from "@/types/winner";
import { pickOptionForCombobox } from "./helpers/autocomplete";
import React from "react";

// Minimal Auth + Users mocks
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, user: { uid: "u-admin" } }),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({
    users: [
      { id: "u1", displayName: "Alpha", email: "a@example.com" },
      { id: "u2", displayName: "Bravo", email: "b@example.com" },
      { id: "u3", displayName: "Charlie", email: "c@example.com" },
      { id: "u4", displayName: "Delta", email: "d@example.com" },
    ],
    isLoading: false,
  }),
}));

// Deterministic ids for places in this test
const ids: string[] = ["p1", "p2", "p3", "p4"]; // predictable UUIDs
let idIdx = 0;
const origRandomUUID = crypto.randomUUID;

beforeEach(() => {
  idIdx = 0;
  // @ts-expect-error override for test determinism
  crypto.randomUUID = () => ids[idIdx++] || `gen-${idIdx}`;
});

afterAll(() => {
  // restore
  crypto.randomUUID = origRandomUUID;
});

function Harness({ initial = [] as WinnerGroup[] }) {
  const [groups, setGroups] = React.useState<WinnerGroup[]>(initial);
  return (
    <GroupedWinnersEditor
      groups={groups}
      onChange={setGroups}
      teamSize={1}
      prizePool={100}
      isCompleted={true}
    />
  );
}

describe("GroupedWinnersEditor - ties and selection", () => {
  it("supports adding a tie for 2nd place and selecting different users independently", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>
    );

    // Add Overall group
    fireEvent.click(screen.getByRole("button", { name: /Add Overall/i }));

    // Add three places: 1st, 2nd, 3rd
    fireEvent.click(screen.getByRole("button", { name: /Add Place/i })); // 1st (p1)
    fireEvent.click(screen.getByRole("button", { name: /Add Place/i })); // 2nd (p2)
    fireEvent.click(screen.getByRole("button", { name: /Add Place/i })); // 3rd (p3)

    // Click Tie on the row showing Place 2 to create another 2nd (p4)
    // Find the specific row that shows "Place 2" and click its Tie button
    const place2Label = screen.getAllByText(/Place 2/i)[0];
    const place2Row = place2Label.closest(
      "div.rounded-md.bg-content2.p-3"
    ) as HTMLElement;
    const tieBtn = within(place2Row).getByRole("button", { name: /Tie/i });
    fireEvent.click(tieBtn);

    // Now there should be two rows that display "Place 2"
    const place2Labels = screen.getAllByText(/Place 2/i);
    expect(place2Labels.length).toBeGreaterThanOrEqual(2);

    // Each row contains a combobox labeled Winner; select different users
    const place2Rows = screen
      .getAllByText(/Place 2/i)
      .map((el) => el.closest("div.rounded-md.bg-content2.p-3") as HTMLElement);
    expect(place2Rows.length).toBe(2);
    const comboA = within(place2Rows[0]).getByRole("combobox", {
      name: /Winner|Team Members/i,
    });
    const comboB = within(place2Rows[1]).getByRole("combobox", {
      name: /Winner|Team Members/i,
    });
    await pickOptionForCombobox(comboA, "Alpha");
    await pickOptionForCombobox(comboB, "Bravo");

    // Selections should be independent — each tied row shows its own selected value
    const inputA = within(place2Rows[0]).getByRole("combobox", {
      name: /Winner|Team Members/i,
    }) as HTMLInputElement;
    const inputB = within(place2Rows[1]).getByRole("combobox", {
      name: /Winner|Team Members/i,
    }) as HTMLInputElement;
    expect(inputA.value).toMatch(/Alpha/i);
    expect(inputB.value).toMatch(/Bravo/i);

    // Display ranks should skip after ties: expect a label "Place 4" present for next distinct place
    expect(screen.getByText(/Place 4/i)).toBeInTheDocument();
  });
});
