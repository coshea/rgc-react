import { useEffect, useMemo, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { addToast } from "@/providers/toast";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { User } from "@/api/users";
import { isAllowedBoardRole } from "@/types/roles";
import { updateUser, deleteUser, createUser } from "@/api/users";
import { formatPhone } from "@/utils/phone";
import { useQueryClient } from "@tanstack/react-query";
import {
  DirectoryHeader,
  DirectoryFilters,
  MemberDirectoryList,
  MemberContactPanel,
  MemberActionsSheet,
  EditMemberModal,
  DeleteMemberModal,
  MergeDuplicatesModal,
} from "@/components/membership"; // barrel export
import {
  useAdminFlag,
  useBoardMemberFlag,
} from "@/components/membership/hooks";
import { useMembers } from "@/hooks/useMembers";
import { useEmailIssues } from "@/hooks/useEmailIssues";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { siteConfig } from "@/config/site";
import {
  DIRECTORY_FILTER,
  type DirectoryFilter,
  filterMembers,
  groupMembersByLetter,
} from "@/utils/memberDirectory";
import { type EmailIssue, emailIssueDocId } from "@@/types";

// Matches the sticky site navbar (45px + 1px border).
const NAVBAR_HEIGHT = 46;
const NO_EMAIL_ISSUES = new Map<string, EmailIssue>();

// Per-browser convenience; the page works the same without storage.
const ADMIN_VIEW_KEY = "rgc.directory.adminView";

function readAdminViewPref(): boolean {
  try {
    return localStorage.getItem(ADMIN_VIEW_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeAdminViewPref(on: boolean) {
  try {
    localStorage.setItem(ADMIN_VIEW_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked (private mode); the toggle still works for this visit.
  }
}

import { usePageTracking } from "@/hooks/usePageTracking";

export default function MembershipDirectoryPage() {
  usePageTracking("Member Directory");
  const { user, userLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useAdminFlag(user);
  const { isBoardMember } = useBoardMemberFlag(user);
  // Admins can turn admin view off to see the page as members do.
  const [adminView, setAdminView] = useState(readAdminViewPref);
  const showAdmin = isAdmin && adminView;
  const isAdminOrBoard = showAdmin || isBoardMember;
  const queryClient = useQueryClient(); // For invalidating queries after user operations
  const currentYear = new Date().getFullYear();
  const membersHook = useMembers(currentYear);
  const allMembers = membersHook.allMembers;
  const pageLoading = loading || membersHook.loading;
  const activeSet = membersHook.activeSet;
  // Members only see people who paid in the last two years.
  const members = useMemo(
    () =>
      showAdmin ? allMembers : allMembers.filter((m) => activeSet.has(m.id)),
    [showAdmin, allMembers, activeSet],
  );

  // Modal state for add/edit user
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  // Merge duplicates modal state
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Admin, phone: the member whose actions sheet is open
  const [actionsFor, setActionsFor] = useState<User | null>(null);

  const [query, setQuery] = useState("");
  // null until the user picks a chip: admins start on active members
  const [pickedFilter, setPickedFilter] = useState<DirectoryFilter | null>(
    null,
  );
  const filter =
    !showAdmin && pickedFilter === DIRECTORY_FILTER.ACTIVE
      ? DIRECTORY_FILTER.ALL
      : (pickedFilter ??
        (showAdmin ? DIRECTORY_FILTER.ACTIVE : DIRECTORY_FILTER.ALL));

  // Desktop shows the selected member in a side panel; the URL keeps the
  // selection so back, refresh and shared links work.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = isDesktop ? searchParams.get("member") : null;

  const visibleMembers = useMemo(
    () => filterMembers(members, { query, filter, activeSet }),
    [members, query, filter, activeSet],
  );
  const sections = useMemo(
    () => groupMembersByLetter(visibleMembers),
    [visibleMembers],
  );
  const selectedMember = selectedId
    ? (members.find((m) => m.id === selectedId) ?? null)
    : null;

  const { data: emailIssueData } = useEmailIssues(isAdmin);
  const emailIssues = showAdmin
    ? (emailIssueData ?? NO_EMAIL_ISSUES)
    : NO_EMAIL_ISSUES;
  const issueFor = (u: User | null) =>
    u?.email ? emailIssues.get(emailIssueDocId(u.email)) : undefined;

  const summary = query.trim()
    ? `${visibleMembers.length} match${visibleMembers.length === 1 ? "" : "es"}`
    : showAdmin
      ? `${activeSet.size} active of ${allMembers.length}`
      : `${members.length} members`;

  // Phone: letter headers stick just below the navbar and the search bar.
  const rootRef = useRef<HTMLDivElement>(null);
  const stickyBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = stickyBarRef.current;
    const root = rootRef.current;
    if (!bar || !root) return;
    const update = () =>
      root.style.setProperty(
        "--directory-sticky-top",
        `${NAVBAR_HEIGHT + bar.offsetHeight}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [pageLoading]);

  // ── CSV export ────────────────────────────────────────────────────────────────

  function downloadCsv(filename: string, rows: string[][]) {
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMemberList() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Membership Type",
      "Last Paid Year",
      "Status",
    ];
    const dataRows = allMembers.map((m) => [
      m.displayName ||
        [m.firstName, m.lastName].filter(Boolean).join(" ") ||
        m.email ||
        m.id,
      m.email ?? "",
      m.phone ?? "",
      m.membershipType ?? "",
      String(m.lastPaidYear ?? ""),
      activeSet.has(m.id) ? "Active" : "Inactive",
    ]);
    downloadCsv(`rgc-members-${currentYear}.csv`, [headers, ...dataRows]);
  }

  useEffect(() => {
    if (!loading && !userLoggedIn) {
      const next = encodeURIComponent(siteConfig.pages.directory.link);
      navigate(`/login?next=${next}`);
      return;
    }
  }, [user, userLoggedIn, loading, navigate]);

  // ----- Helper Actions -----
  function openAdd() {
    setEditing(null);
    setForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthYear: "",
      ghinNumber: "",
      tShirtSize: "",
      boardMember: false,
      role: "",
    });
    setOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({
      firstName: u.firstName || "",
      lastName: u.lastName || "",
      email: u.email || "",
      phone: u.phone || "",
      birthYear: typeof u.birthYear === "number" ? String(u.birthYear) : "",
      ghinNumber: u.ghinNumber || "",
      tShirtSize: u.tShirtSize || "",
      boardMember: !!u.boardMember,
      role: u.boardMember ? u.role || "" : "",
      defaultGoldTee: u.defaultGoldTee,
    });
    setOpen(true);
  }

  function requestDelete(u: User) {
    setConfirmDelete(u);
  }

  async function save(): Promise<string | undefined> {
    if (!isAdmin) return;
    try {
      const phoneToSave = formatPhone(form.phone);
      // Conditional validation: role is required if boardMember is checked
      if (form.boardMember && !form.role?.trim()) {
        addToast({
          title: "Role Required",
          description:
            "Board members must have a role (e.g. President, Secretary)",
          color: "warning",
        });
        return;
      }
      if (form.boardMember && form.role && !isAllowedBoardRole(form.role)) {
        addToast({
          title: "Invalid Role",
          description: "Selected role is not allowed.",
          color: "danger",
        });
        return;
      }
      if (editing) {
        await updateUser(editing.id, {
          firstName: (form.firstName || "").trim(),
          lastName: (form.lastName || "").trim(),
          email: form.email || "",
          phone: phoneToSave || "",
          birthYear: Number(form.birthYear || 0),
          ghinNumber: (form.ghinNumber || "").trim(),
          tShirtSize: (form.tShirtSize || "").trim() as User["tShirtSize"],
          boardMember: !!form.boardMember,
          role: form.boardMember ? (form.role || "").trim() : null,
          ...(typeof form.defaultGoldTee === "boolean" && {
            defaultGoldTee: form.defaultGoldTee,
          }),
        });
        console.log("[Directory] User updated", { id: editing.id, ...form });

        // Return undefined explicitly for updates
        return undefined;
      } else {
        const docRef = await createUser({
          firstName: (form.firstName || "").trim() || undefined,
          lastName: (form.lastName || "").trim() || undefined,
          email: form.email || "",
          phone: phoneToSave || "",
          birthYear: Number(form.birthYear || 0) || undefined,
          ghinNumber: (form.ghinNumber || "").trim() || undefined,
          tShirtSize:
            ((form.tShirtSize || "").trim() as User["tShirtSize"]) || undefined,
          boardMember: !!form.boardMember,
          role: form.boardMember ? (form.role || "").trim() : null,
          migrationEligible: true,
        });
        const newUserId = docRef.id;
        console.log("[Directory] User added", { id: newUserId, ...form });

        // Invalidate users query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["users"] });

        setOpen(false);

        // Return the new user ID for payment processing
        return newUserId;
      }

      // Invalidate users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["users"] });

      setOpen(false);
    } catch (e) {
      console.error(e);
      addToast({ title: "Error", description: "Save failed", color: "danger" });
      console.log("[Directory] User save failed", e);
      throw e; // Re-throw so EditMemberModal can handle the error
    }
  }

  async function confirmDeleteUser() {
    if (!isAdmin || !confirmDelete) return;
    try {
      if (confirmDelete.id === user?.uid) {
        addToast({
          title: "Action Blocked",
          description: "You can't delete your own profile.",
          color: "warning",
        });
        setConfirmDelete(null);
        console.log("[Directory] Attempted self-delete blocked", {
          id: confirmDelete.id,
        });
        return;
      }
      await deleteUser(confirmDelete.id);
      addToast({
        title: "User Deleted",
        description: `${confirmDelete.displayName || confirmDelete.email || "User"} removed`,
        color: "success",
      });
      if (confirmDelete.id === selectedId) {
        searchParams.delete("member");
        setSearchParams(searchParams, { replace: true });
      }
      setConfirmDelete(null);

      // Invalidate users query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["users"] });

      console.log("[Directory] User deleted", { id: confirmDelete.id });
    } catch (e) {
      console.error(e);
      addToast({
        title: "Error",
        description: "Delete failed",
        color: "danger",
      });
      console.log("[Directory] User delete failed", e);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner aria-label="Loading members" />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-6 lg:py-8"
      data-testid="membership-directory-root"
    >
      <DirectoryHeader
        isAdmin={showAdmin}
        isAdminOrBoard={isAdminOrBoard}
        summary={summary}
        onAdd={openAdd}
        onFindDuplicates={() => setShowMergeModal(true)}
        onExportMembers={exportMemberList}
        members={allMembers}
        activeSet={activeSet}
        currentYear={currentYear}
        adminViewToggle={
          isAdmin
            ? {
                isSelected: adminView,
                onChange: (on) => {
                  setAdminView(on);
                  writeAdminViewPref(on);
                },
              }
            : undefined
        }
      />
      <div
        ref={stickyBarRef}
        className="sticky top-[46px] z-20 -mx-4 mt-3 bg-background px-4 py-2 lg:static lg:mx-0 lg:mb-6 lg:mt-5 lg:p-0"
      >
        <DirectoryFilters
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setPickedFilter}
          showActiveFilter={showAdmin}
        />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <MemberDirectoryList
          sections={sections}
          isAdmin={showAdmin}
          isDesktop={isDesktop}
          selectedId={selectedId}
          emailIssues={emailIssues}
          year={currentYear}
          query={query}
          onClearSearch={() => setQuery("")}
          onMore={setActionsFor}
        />
        {isDesktop && (
          <MemberContactPanel
            member={selectedMember}
            isAdmin={showAdmin}
            emailIssue={issueFor(selectedMember)}
            onEdit={openEdit}
            onDelete={requestDelete}
          />
        )}
      </div>

      <MemberActionsSheet
        member={showAdmin && !isDesktop ? actionsFor : null}
        year={currentYear}
        emailIssue={issueFor(actionsFor)}
        onClose={() => setActionsFor(null)}
        onEdit={openEdit}
        onDelete={requestDelete}
      />
      <EditMemberModal
        open={open}
        editing={editing}
        form={form}
        onChange={(next) => setForm(next as Record<string, any>)}
        onClose={() => setOpen(false)}
        onSave={save}
        isAdmin={isAdmin}
      />
      <DeleteMemberModal
        user={confirmDelete}
        selfId={user?.uid}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteUser}
      />
      <MergeDuplicatesModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        users={members}
        onMergeComplete={() => {
          // Invalidate users query to refresh the list after merge
          queryClient.invalidateQueries({ queryKey: ["users"] });
        }}
      />
    </div>
  );
}
