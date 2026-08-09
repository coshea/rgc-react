import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataGridColumn } from "@heroui-pro/react/data-grid";
import { DataGrid } from "@heroui-pro/react/data-grid";
import { Button, Chip, Spinner } from "@heroui/react";
import { SearchInput } from "@/components/search-input";
import { Icon } from "@iconify/react";
import { useQueryClient } from "@tanstack/react-query";

import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/providers/AuthProvider";
import {
  useAdminFlag,
  useMembersPushStatus,
} from "@/components/membership/hooks";
import { EditMemberModal } from "@/components/membership";
import { UserAvatar } from "@/components/avatar";
import { updateUser } from "@/api/users";
import type { User } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";
import { formatPhone } from "@/utils/phone";
import { hasStoredPushPreferenceEnabled } from "@/utils/notificationPreferences";
import { isAllowedBoardRole } from "@/types/roles";
import { addToast } from "@/providers/toast";
import * as Sentry from "@sentry/react";

// ─── Row shape ────────────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  user: User;
  displayName: string;
  email: string;
  phone: string;
  ghinNumber: string;
  membershipType: string;
  isActive: boolean;
  defaultGoldTee: boolean | null;
  pushEnabled: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function membershipLabel(type?: string | null): string {
  if (type === MEMBERSHIP_TYPES.FULL) return "Full";
  if (type === MEMBERSHIP_TYPES.HANDICAP) return "Handicap";
  return type ?? "—";
}

function membershipColor(
  type?: string | null,
): "success" | "accent" | "default" {
  if (type === MEMBERSHIP_TYPES.FULL) return "success";
  if (type === MEMBERSHIP_TYPES.HANDICAP) return "accent";
  return "default";
}

// ─── Self-contained edit dialog (owns form state so typing never re-renders the grid) ─

interface MemberEditDialogProps {
  open: boolean;
  editing: User | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (uid: string) => void;
}

type MemberEditFormState = Record<string, string | boolean | undefined | null>;

function MemberEditDialog({
  open,
  editing,
  isAdmin,
  onClose,
  onSaved,
}: MemberEditDialogProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<MemberEditFormState>({});

  // Initialise form whenever the editing subject changes
  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editing) return;
    if (editing.id === prevIdRef.current) return; // same user, don't reset
    prevIdRef.current = editing.id;
    setForm({
      firstName: editing.firstName ?? "",
      lastName: editing.lastName ?? "",
      email: editing.email ?? "",
      phone: editing.phone ?? "",
      ghinNumber: editing.ghinNumber ?? "",
      boardMember: !!editing.boardMember,
      role: editing.boardMember ? (editing.role ?? "") : "",
      defaultGoldTee: editing.defaultGoldTee,
    });
  }, [editing]);

  // Reset prevIdRef when the dialog closes so reopening the same user still re-inits
  useEffect(() => {
    if (!open) prevIdRef.current = null;
  }, [open]);

  const handleSave = useCallback(async (): Promise<string | undefined> => {
    if (!isAdmin || !editing) return;
    const phoneToSave = formatPhone(String(form.phone ?? ""));
    if (form.boardMember && !String(form.role ?? "").trim()) {
      addToast({
        title: "Role Required",
        description: "Board members must have a role.",
        color: "warning",
      });
      return;
    }
    if (
      form.boardMember &&
      form.role &&
      !isAllowedBoardRole(String(form.role))
    ) {
      addToast({
        title: "Invalid Role",
        description: "Selected role is not allowed.",
        color: "danger",
      });
      return;
    }
    try {
      await Sentry.startSpan({ op: "db.write", name: "updateUser" }, () =>
        updateUser(editing.id, {
          firstName: String(form.firstName ?? "").trim(),
          lastName: String(form.lastName ?? "").trim(),
          email: String(form.email ?? ""),
          phone: phoneToSave,
          ghinNumber: String(form.ghinNumber ?? "").trim(),
          boardMember: !!form.boardMember,
          role: form.boardMember ? String(form.role ?? "").trim() : null,
          ...(form.defaultGoldTee !== undefined &&
            form.defaultGoldTee !== null && {
              defaultGoldTee: !!form.defaultGoldTee,
            }),
        }),
      );
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["userProfile", editing.id] });
      onSaved(editing.id);
      return undefined;
    } catch (err) {
      Sentry.captureException(err);
      addToast({
        title: "Save failed",
        description: "There was an error updating the member.",
        color: "danger",
      });
      throw err;
    }
  }, [isAdmin, editing, form, qc, onSaved]);

  return (
    <EditMemberModal
      open={open}
      editing={editing}
      form={form}
      onChange={(next) => setForm(next as MemberEditFormState)}
      onClose={onClose}
      onSave={handleSave}
      isAdmin={isAdmin}
    />
  );
}

// ─── Row actions menu ─────────────────────────────────────────────────────────

function RowEditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <Button
      isIconOnly
      aria-label="Edit member"
      size="sm"
      variant="tertiary"
      onPress={onEdit}
    >
      <Icon icon="lucide:pencil" className="w-4 h-4" />
    </Button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MemberDataGridTab() {
  const currentYear = new Date().getFullYear();
  const { user: authUser } = useAuth();
  const { isAdmin } = useAdminFlag(authUser);

  const { allMembers, loading, activeSet } = useMembers(currentYear);
  const { pushEnabledUids } = useMembersPushStatus(isAdmin);

  // Search filter
  const [search, setSearch] = useState("");

  // Edit modal state — only User ref + open flag; form lives in MemberEditDialog
  const [editing, setEditing] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ── Transform members into row data ─────────────────────────────────────────

  const rows: MemberRow[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMembers
      .filter((m) => {
        if (!q) return true;
        const name = (
          m.displayName ||
          [m.firstName, m.lastName].filter(Boolean).join(" ") ||
          ""
        ).toLowerCase();
        return (
          name.includes(q) ||
          (m.email ?? "").toLowerCase().includes(q) ||
          (m.ghinNumber ?? "").toLowerCase().includes(q) ||
          (m.phone ?? "").toLowerCase().includes(q)
        );
      })
      .map((m) => ({
        id: m.id,
        user: m,
        displayName:
          m.displayName ||
          [m.firstName, m.lastName].filter(Boolean).join(" ") ||
          m.email ||
          m.id,
        email: m.email ?? "",
        phone: m.phone ?? "",
        ghinNumber: m.ghinNumber ?? "",
        membershipType: m.membershipType ?? "",
        isActive: activeSet.has(m.id),
        defaultGoldTee: m.defaultGoldTee ?? null,
        pushEnabled:
          pushEnabledUids.has(m.id) ||
          hasStoredPushPreferenceEnabled(m.notificationPreferences),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allMembers, activeSet, search, pushEnabledUids]);

  // ── Open edit modal ──────────────────────────────────────────────────────────

  const openEdit = useCallback((row: MemberRow) => {
    setEditing(row.user);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

  // ── Column definitions ───────────────────────────────────────────────────────

  const columns: DataGridColumn<MemberRow>[] = useMemo(
    () => [
      {
        id: "member",
        header: "Member",
        accessorKey: "displayName",
        isRowHeader: true,
        allowsSorting: true,
        allowsResizing: true,
        minWidth: 220,
        cell: (row) => (
          <div className="flex items-center gap-3">
            <UserAvatar user={row.user} size="sm" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">
                {row.displayName}
              </span>
              <span className="text-xs text-muted truncate">{row.email}</span>
            </div>
          </div>
        ),
      },
      {
        id: "phone",
        header: "Phone",
        accessorKey: "phone",
        allowsResizing: true,
        minWidth: 150,
        cellClassName: "text-sm text-muted",
        cell: (row) => <span>{row.phone || "—"}</span>,
      },
      {
        id: "ghinNumber",
        header: "GHIN",
        accessorKey: "ghinNumber",
        allowsResizing: true,
        allowsSorting: true,
        minWidth: 120,
        cellClassName: "font-mono text-xs text-muted",
        cell: (row) => <span>{row.ghinNumber || "—"}</span>,
      },
      {
        id: "membershipType",
        header: "Membership",
        accessorKey: "membershipType",
        allowsSorting: true,
        allowsResizing: true,
        minWidth: 140,
        cell: (row) =>
          row.membershipType ? (
            <Chip
              color={membershipColor(row.membershipType)}
              size="sm"
              variant="soft"
            >
              {membershipLabel(row.membershipType)}
            </Chip>
          ) : (
            <span className="text-xs text-muted">—</span>
          ),
      },
      {
        id: "isActive",
        header: "Status",
        accessorKey: "isActive",
        allowsSorting: true,
        allowsResizing: true,
        minWidth: 110,
        cell: (row) => (
          <Chip
            color={row.isActive ? "success" : "default"}
            size="sm"
            variant="soft"
          >
            {row.isActive ? "Active" : "Inactive"}
          </Chip>
        ),
      },
      {
        id: "pushEnabled",
        header: "Push Enabled",
        accessorKey: "pushEnabled",
        allowsSorting: true,
        allowsResizing: true,
        minWidth: 80,
        cell: (row) => (
          <div className="flex justify-center w-full">
            <Icon
              icon={row.pushEnabled ? "lucide:bell" : "lucide:bell-off"}
              className={`w-4 h-4 ${row.pushEnabled ? "text-success" : "text-muted/40"}`}
            />
          </div>
        ),
      },
      {
        id: "defaultGoldTee",
        header: "Default Gold Tees",
        accessorKey: "defaultGoldTee",
        allowsSorting: true,
        allowsResizing: true,
        minWidth: 120,
        cell: (row) =>
          row.defaultGoldTee === null ? (
            <span className="text-xs text-muted"></span>
          ) : (
            <Chip
              color={row.defaultGoldTee ? "warning" : "default"}
              size="sm"
              variant="soft"
            >
              {row.defaultGoldTee ? "Yes" : "No"}
            </Chip>
          ),
      },
      {
        id: "actions",
        header: "",
        align: "end",
        allowsResizing: false,
        width: 60,
        pinned: "end",
        cell: (row) => <RowEditButton onEdit={() => openEdit(row)} />,
      },
    ],
    [openEdit],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <SearchInput
          ariaLabel="Search members"
          placeholder="Search by name, email, GHIN…"
          value={search}
          onChange={setSearch}
          className="max-w-xs"
        />
        <span className="text-xs text-muted ml-auto">
          {rows.length} member{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <DataGrid
          allowsColumnResize
          aria-label="Members"
          columns={columns}
          contentClassName="min-w-[800px]"
          data={rows}
          defaultSortDescriptor={{ column: "member", direction: "ascending" }}
          getRowId={(row) => row.id}
          renderEmptyState={() =>
            search ? "No members match your search." : "No members found."
          }
          variant="primary"
        />
      )}

      {/* Edit modal — form state is self-contained inside MemberEditDialog */}
      <MemberEditDialog
        open={modalOpen}
        editing={editing}
        isAdmin={isAdmin}
        onClose={closeModal}
        onSaved={closeModal}
      />
    </div>
  );
}
