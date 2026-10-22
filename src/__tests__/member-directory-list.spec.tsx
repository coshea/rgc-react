import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { MemoryRouter } from "react-router-dom";

import type { User } from "@/api/users";
import {
  DirectoryHeader,
  MemberContactPanel,
  MemberDirectoryList,
} from "@/components/membership";
import { groupMembersByLetter } from "@/utils/memberDirectory";
import { EMAIL_ISSUE_STATUS, type EmailIssue } from "@@/types";

vi.mock("@/hooks/useEmailIssues", () => ({
  useClearEmailIssue: () => ({ mutate: vi.fn(), isPending: false }),
}));

const members: User[] = [
  {
    id: "bb",
    displayName: "Bill Baxter",
    email: "bbaxter@test.local",
    phone: "2035550114",
    boardMember: true,
    role: "Treasurer",
    membershipType: "full",
    lastPaidYear: 2026,
  },
  {
    id: "db",
    displayName: "Dana Brooks",
    email: "dbrooks@test.local",
    membershipType: "handicap",
    lastPaidYear: 2026,
  },
];

const issues = new Map<string, EmailIssue>([
  [
    "dbrooks@test.local",
    {
      email: "dbrooks@test.local",
      status: EMAIL_ISSUE_STATUS.BOUNCED,
      occurredAt: "2026-10-03T12:00:00Z",
    } as EmailIssue,
  ],
]);

function renderList(
  props: Partial<React.ComponentProps<typeof MemberDirectoryList>> = {},
) {
  const onMore = vi.fn();
  render(
    <MemoryRouter>
      <MemberDirectoryList
        sections={groupMembersByLetter(members)}
        isAdmin={false}
        isDesktop={false}
        selectedId={null}
        emailIssues={new Map()}
        year={2026}
        query=""
        onClearSearch={() => {}}
        onMore={onMore}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onMore };
}

describe("MemberDirectoryList (phone)", () => {
  it("groups members under letter headings with call and email links", () => {
    renderList();
    expect(screen.getByRole("heading", { name: "B" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Call Bill Baxter" }).getAttribute("href")).toBe("tel:2035550114");
    expect(screen.getByRole("link", { name: "Email Dana Brooks" }).getAttribute("href")).toBe("mailto:dbrooks@test.local");
    // No phone on file: no call link
    expect(screen.queryByRole("link", { name: "Call Dana Brooks" })).toBeNull();
    expect(screen.getByText("Treasurer")).toBeTruthy();
  });

  it("hides membership status and admin actions from members", () => {
    renderList();
    expect(screen.queryByText("Full, paid 2026")).toBeNull();
    expect(screen.queryByRole("button", { name: /More actions/ })).toBeNull();
  });

  it("gives admins status, bounce warnings and a per-member actions button", async () => {
    const { onMore } = renderList({ isAdmin: true, emailIssues: issues });
    expect(screen.getByText("Handicap only, paid 2026")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Email Dana Brooks (emails are bouncing)" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More actions for Dana Brooks" }));
    expect(onMore).toHaveBeenCalledWith(members[1]);
  });

  it("offers to clear a search with no results", () => {
    renderList({ sections: [], query: "zzz" });
    expect(screen.getByText("No members match “zzz”.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
  });
});

describe("MemberDirectoryList (desktop)", () => {
  it("links each row to its selection and marks the selected one", () => {
    renderList({ isDesktop: true, selectedId: "bb" });
    const selected = screen.getByRole("link", { name: /Bill Baxter/ });
    expect(selected.getAttribute("aria-current")).toBe("true");
    expect(selected.getAttribute("href")).toBe("/?member=bb");
    expect(screen.queryByRole("link", { name: /^Call / })).toBeNull();
  });
});

describe("MemberContactPanel", () => {
  it("shows contact actions to members without the admin section", () => {
    render(
      <MemoryRouter>
        <MemberContactPanel
          member={members[0]}
          isAdmin={false}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:2035550114");
    expect(screen.getByRole("link", { name: "View profile" }).getAttribute("href")).toBe("/profile/bb");
    expect(screen.queryByText("Only admins see this section")).toBeNull();
  });

  it("gives admins membership details and edit/delete", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <MemberContactPanel
          member={members[1]}
          isAdmin
          emailIssue={issues.get("dbrooks@test.local")}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </MemoryRouter>,
    );
    const section = screen.getByRole("region", { name: "Membership" });
    expect(within(section).getByText("Handicap only")).toBeTruthy();
    expect(within(section).getByText(/Emails to this address bounced/)).toBeTruthy();
    fireEvent.click(within(section).getByRole("button", { name: /Edit member/ }));
    expect(onEdit).toHaveBeenCalledWith(members[1]);
    fireEvent.click(within(section).getByRole("button", { name: /Delete member/ }));
    expect(onDelete).toHaveBeenCalledWith(members[1]);
  });

  it("labels handicap-only members under their name, like the profile page", () => {
    const { rerender } = render(
      <MemoryRouter>
        <MemberContactPanel member={members[1]} isAdmin={false} onEdit={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Handicap Only")).toBeTruthy();
    rerender(
      <MemoryRouter>
        <MemberContactPanel member={members[0]} isAdmin={false} onEdit={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Handicap Only")).toBeNull();
  });

  it("prompts for a selection when nobody is selected", () => {
    render(
      <MemoryRouter>
        <MemberContactPanel member={null} isAdmin={false} onEdit={() => {}} onDelete={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Select a member to see their contact details.")).toBeTruthy();
  });
});

describe("DirectoryHeader admin view switch", () => {
  const baseProps = {
    isAdminOrBoard: false,
    summary: "2 members",
    onAdd: () => {},
    onFindDuplicates: () => {},
    onExportMembers: () => {},
    members,
    activeSet: new Set<string>(),
    currentYear: 2026,
  };

  it("lets admins turn admin view off, which hides the admin tools", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DirectoryHeader
        {...baseProps}
        isAdmin
        isAdminOrBoard
        adminViewToggle={{ isSelected: true, onChange }}
      />,
    );
    expect(screen.getAllByText("Add member").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("switch", { name: "Admin view" }));
    expect(onChange).toHaveBeenCalledWith(false);

    rerender(
      <DirectoryHeader
        {...baseProps}
        isAdmin={false}
        adminViewToggle={{ isSelected: false, onChange }}
      />,
    );
    expect(screen.queryByText("Add member")).toBeNull();
    expect(screen.getByRole("switch", { name: "Admin view" })).toBeTruthy();
  });

  it("is not shown to members", () => {
    render(<DirectoryHeader {...baseProps} isAdmin={false} />);
    expect(screen.queryByRole("switch", { name: "Admin view" })).toBeNull();
  });
});
