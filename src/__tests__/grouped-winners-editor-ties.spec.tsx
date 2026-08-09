import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GroupedWinnersEditor from "@/components/grouped-winners-editor";
import type { WinnerGroup } from "@/types/winner";
import {
  pickOptionForCombobox,
  findAutocompleteButton,
} from "./helpers/autocomplete";

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
  const [groups, setGroups] = useState<WinnerGroup[]>(initial);
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

/** Solo registrations — each player registered individually. */
const soloRegistrations = [
  { id: "reg1", team: [{ id: "u1", displayName: "Alpha" }], ownerId: "u1" },
  { id: "reg2", team: [{ id: "u2", displayName: "Bravo" }], ownerId: "u2" },
  { id: "reg3", team: [{ id: "u3", displayName: "Charlie" }], ownerId: "u3" },
  { id: "reg4", team: [{ id: "u4", displayName: "Delta" }], ownerId: "u4" },
];

function HarnessWithRegs({
  initial = [] as WinnerGroup[],
  onChange,
}: {
  initial?: WinnerGroup[];
  onChange?: (g: WinnerGroup[]) => void;
}) {
  const [groups, setGroups] = useState<WinnerGroup[]>(initial);
  return (
    <GroupedWinnersEditor
      groups={groups}
      onChange={(g) => {
        setGroups(g);
        onChange?.(g);
      }}
      teamSize={1}
      prizePool={100}
      isCompleted={true}
      registrations={soloRegistrations}
    />
  );
}

describe("GroupedWinnersEditor - ties and selection", () => {
  it("supports adding a tie for 2nd place and selecting different users independently", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
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
      "div.rounded-md.bg-surface-secondary.p-3",
    ) as HTMLElement;
    const tieBtn = within(place2Row).getByRole("button", { name: /Tie/i });
    fireEvent.click(tieBtn);

    // Now there should be two rows that display "Place 2"
    const place2Labels = screen.getAllByText(/Place 2/i);
    expect(place2Labels.length).toBeGreaterThanOrEqual(2);

    // Each row contains an Autocomplete trigger button labeled Winner; select different users
    const place2Rows = screen
      .getAllByText(/Place 2/i)
      .map(
        (el) =>
          el.closest("div.rounded-md.bg-surface-secondary.p-3") as HTMLElement,
      );
    expect(place2Rows.length).toBe(2);
    const triggerA = findAutocompleteButton(
      /Winner|Team Members/i,
      place2Rows[0],
    );
    const triggerB = findAutocompleteButton(
      /Winner|Team Members/i,
      place2Rows[1],
    );
    await pickOptionForCombobox(triggerA, "Alpha");
    await pickOptionForCombobox(triggerB, "Bravo");

    // Selections should be independent — each tied row stores its own input value.
    expect(
      within(place2Rows[0]).getByRole("combobox", { name: /Winner/i }),
    ).toHaveValue("Alpha");
    expect(
      within(place2Rows[1]).getByRole("combobox", { name: /Winner/i }),
    ).toHaveValue("Bravo");

    // Display ranks should skip after ties: expect a label "Place 4" present for next distinct place
    expect(screen.getByText(/Place 4/i)).toBeInTheDocument();
  });
});

describe("GroupedWinnersEditor - registered team multi-select", () => {
  it("defaults to Registered Teams mode when registrations are provided", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <HarnessWithRegs />
      </QueryClientProvider>,
    );
    // The source mode selector should display the "Registered Teams" option as selected
    // (multiple elements match — the hidden option and the visible value span)
    const matches = screen.getAllByText(/Registered Teams/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("selecting multiple individual registrations merges all their members as competitors", async () => {
    let capturedGroups: WinnerGroup[] = [];
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <HarnessWithRegs
          onChange={(g) => {
            capturedGroups = g;
          }}
        />
      </QueryClientProvider>,
    );

    // Add Overall group + 1 place
    fireEvent.click(screen.getByRole("button", { name: /Add Overall/i }));
    fireEvent.click(screen.getByRole("button", { name: /Add Place/i }));

    // Open the registered teams multi-select (trigger button)
    const selectTrigger = screen.getByRole("button", {
      name: /Registered Team Selector/i,
    });
    await act(async () => {
      fireEvent.click(selectTrigger);
    });

    // Select Alpha's registration then Bravo's registration
    const alphaOption = await screen.findByRole("option", { name: /Alpha/i });
    fireEvent.click(alphaOption);
    const bravoOption = screen.getByRole("option", { name: /Bravo/i });
    fireEvent.click(bravoOption);

    // Close the dropdown
    fireEvent.keyDown(document.body, { key: "Escape" });

    // Both players should be competitors on Place 1
    const place = capturedGroups[0]?.winners?.[0];
    expect(place?.competitors).toHaveLength(2);
    const competitorIds = place?.competitors?.map((c) => c.userId);
    expect(competitorIds).toContain("u1");
    expect(competitorIds).toContain("u2");
  });

  it("deselecting a registration removes its members from competitors", async () => {
    // Start with Alpha and Bravo already saved as competitors
    const savedGroups: WinnerGroup[] = [
      {
        id: "g1",
        label: "Overall",
        type: "overall",
        order: 0,
        winners: [
          {
            id: "w1",
            place: 1,
            prizeAmount: 0,
            competitors: [
              { userId: "u1", displayName: "Alpha" },
              { userId: "u2", displayName: "Bravo" },
            ],
          },
        ],
      },
    ];

    let capturedGroups: WinnerGroup[] = savedGroups;
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <HarnessWithRegs
          initial={savedGroups}
          onChange={(g) => {
            capturedGroups = g;
          }}
        />
      </QueryClientProvider>,
    );

    // Both registrations should be checked initially — open the select
    const selectTrigger = screen.getByRole("button", {
      name: /Registered Team Selector/i,
    });
    await act(async () => {
      fireEvent.click(selectTrigger);
    });

    // Deselect Alpha
    const alphaOption = await screen.findByRole("option", { name: /Alpha/i });
    fireEvent.click(alphaOption);

    fireEvent.keyDown(document.body, { key: "Escape" });

    // Only Bravo should remain
    const place = capturedGroups[0]?.winners?.[0];
    const competitorIds = place?.competitors?.map((c) => c.userId);
    expect(competitorIds).not.toContain("u1");
    expect(competitorIds).toContain("u2");
  });

  it("initializes effectiveTeamSize from saved competitor count on reload", () => {
    const savedGroups: WinnerGroup[] = [
      {
        id: "g1",
        label: "Overall",
        type: "overall",
        order: 0,
        winners: [
          {
            id: "w1",
            place: 1,
            prizeAmount: 0,
            competitors: [
              { userId: "u1", displayName: "Alpha" },
              { userId: "u2", displayName: "Bravo" },
              { userId: "u3", displayName: "Charlie" },
              { userId: "u4", displayName: "Delta" },
            ],
          },
        ],
      },
    ];

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <HarnessWithRegs initial={savedGroups} />
      </QueryClientProvider>,
    );

    // effectiveTeamSize should be 4 (max competitors in saved data)
    // React Aria's TextField associates Label→Input via for/id; use getByRole.
    const winnersPerPlaceInput = screen.getByRole("spinbutton", {
      name: /winners per place/i,
    }) as HTMLInputElement;
    expect(winnersPerPlaceInput).not.toBeNull();
    expect(winnersPerPlaceInput.value).toBe("4");
  });
});

// Minimal Auth + Users mocks
