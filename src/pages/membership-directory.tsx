import { useEffect, useState, useRef } from "react";
import { addToast } from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import type { User } from "@/api/users";
import { isAllowedBoardRole } from "@/types/roles";
import {
  updateUser,
  deleteUser,
  bulkCreateUsers,
  createUser,
} from "@/api/users";
import type { UserProfilePayload } from "@/api/users";
import { parseUsersCsv } from "@/services/csv";
import { formatPhone } from "@/utils/phone";
import {
  DirectoryHeader,
  DirectorySearchBar,
  MembersList,
  EditMemberModal,
  DeleteMemberModal,
  CsvPreviewModal,
} from "@/components/membership"; // barrel export
import { useDocAdminFlag } from "@/components/membership/hooks"; // still used for immediate admin gating in header (retained until full migration)
import { useMembers } from "@/hooks/useMembers";
import { Switch } from "@heroui/react";
// preflightCsv imported via barrel if needed later

export default function MembershipDirectoryPage() {
  const { user, userLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useDocAdminFlag(user as any); // local check for early redirect logic unchanged
  const currentYear = new Date().getFullYear();
  const membersHook = useMembers(currentYear);
  const members = membersHook.isAdmin
    ? membersHook.allMembers
    : membersHook.members;

  // Modal state for add/edit user
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  // Delete confirmation state
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  // Bulk CSV upload state
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<UserProfilePayload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
  }>({
    processed: 0,
    total: 0,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // search filter
  const [filter, setFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const activeSet = membersHook.activeSet;

  // Phone helpers moved to utils/phone.ts

  useEffect(() => {
    if (!loading && !userLoggedIn) {
      const next = encodeURIComponent("/membership");
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
      boardMember: !!u.boardMember,
      role: u.boardMember ? u.role || "" : "",
    });
    setOpen(true);
  }

  function requestDelete(u: User) {
    setConfirmDelete(u);
  }

  function onSelectCsv() {
    fileInputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      const rows = parseUsersCsv(text);
      setCsvRows(rows);
      setCsvOpen(true);
    };
    reader.readAsText(f);
    // clear input so same file can be re-selected
    e.target.value = "";
  }

  async function uploadCsv() {
    if (!isAdmin) {
      addToast({
        title: "Not Authorized",
        description: "You are not an admin.",
        color: "danger",
      });
      return;
    }
    if (csvRows.length === 0) return;
    // Enhanced Preflight Validation
    // 1. Sanitize & trim all relevant string fields
    const sanitized = csvRows.map((r, idx) => {
      const firstName = (r.firstName || "").trim();
      const lastName = (r.lastName || "").trim();
      const email = (r.email || "").trim();
      const phone = (r.phone || "").trim();
      const ghinNumber = (r.ghinNumber || "").trim();
      return {
        ...r,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email,
        phone,
        ghinNumber,
        // Board fields will be stripped later but preserve for diagnostics initially
        __index: idx,
      } as any;
    });

    // 2. Disallow boardMember/role assignments; gather diagnostics instead of immediate abort
    const boardIntendedRows = sanitized.filter(
      (r: any) =>
        r.boardMember === true || (typeof r.role === "string" && r.role.trim())
    );
    if (boardIntendedRows.length) {
      console.warn(
        "[Directory] Stripping boardMember/role fields from bulk CSV rows",
        boardIntendedRows.slice(0, 5).map((r: any) => ({
          row: r.__index + 1,
          boardMember: r.boardMember,
          role: r.role,
        }))
      );
      boardIntendedRows.forEach((r) => {
        delete r.boardMember;
        delete r.role;
      });
      addToast({
        title: "Board Fields Ignored",
        description: `${boardIntendedRows.length} row${boardIntendedRows.length === 1 ? "" : "s"} had board/role data stripped`,
        color: "warning",
      });
    }

    // 3. Email validation (non-empty + rudimentary format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // simple, sufficient client-side
    const invalidEmailRows: { row: number; email: string; reason: string }[] =
      [];
    sanitized.forEach((r: any) => {
      if (!r.email) {
        invalidEmailRows.push({
          row: r.__index + 1,
          email: r.email,
          reason: "missing",
        });
      } else if (!emailRegex.test(r.email)) {
        invalidEmailRows.push({
          row: r.__index + 1,
          email: r.email,
          reason: "format",
        });
      }
    });
    if (invalidEmailRows.length) {
      console.warn(
        "[Directory] Invalid emails detected",
        invalidEmailRows.slice(0, 10)
      );
      addToast({
        title: "Invalid Emails",
        description: `${invalidEmailRows.length} invalid email row${invalidEmailRows.length === 1 ? "" : "s"}. Fix and retry.`,
        color: "danger",
      });
      return;
    }

    // 4. Duplicate email detection (case-insensitive)
    const emailMap = new Map<string, number[]>();
    sanitized.forEach((r: any) => {
      const key = r.email.toLowerCase();
      if (!emailMap.has(key)) emailMap.set(key, []);
      emailMap.get(key)!.push(r.__index + 1);
    });
    const duplicateEmails = Array.from(emailMap.entries())
      .filter(([, rows]) => rows.length > 1)
      .map(([email, rows]) => ({ email, rows }));
    if (duplicateEmails.length) {
      console.warn(
        "[Directory] Duplicate emails in CSV preflight",
        duplicateEmails.slice(0, 10)
      );
      addToast({
        title: "Duplicate Emails",
        description: `${duplicateEmails.length} duplicate email group${duplicateEmails.length === 1 ? "" : "s"} found. Resolve and re-upload.`,
        color: "danger",
      });
      return;
    }

    // 5. Prepare final rows for bulk create (strip preflight artifacts)
    const finalRows = sanitized.map((r: any) => {
      const { __index, boardMember, role, ...rest } = r; // board fields intentionally omitted
      return rest;
    });

    // 6. Diagnostic sample logging
    console.table(
      finalRows.slice(0, 5).map((r, i) => ({
        sampleRow: i + 1,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        ghinNumber: r.ghinNumber,
      }))
    );
    console.log("[Directory] CSV preflight passed", {
      total: finalRows.length,
      strippedBoardRows: boardIntendedRows.length,
    });
    setUploading(true);
    setUploadProgress({ processed: 0, total: finalRows.length });
    try {
      console.log("[Directory] Starting CSV bulk upload", {
        rows: finalRows.length,
        sample: finalRows.slice(0, 3),
        isAdmin,
      });
      const count = await bulkCreateUsers(finalRows, {
        onProgress: (processed, total) => {
          setUploadProgress({ processed, total });
          // occasional console progress (every 25 or full)
          if (processed === total || processed % 25 === 0) {
            console.log("[Directory] Bulk upload progress", {
              processed,
              total,
            });
          }
        },
      });
      setCsvOpen(false);
      setCsvRows([]);
      addToast({
        title: "Upload Complete",
        description: `${count} member${count === 1 ? "" : "s"} imported successfully`,
        color: "success",
      });
      console.log("[Directory] CSV bulk upload success", { count });
      console.log("[Directory] CSV bulk upload success", { count });
    } catch (e) {
      console.error("CSV bulk upload error", e);
      // Surface more informative message if available (e.g. aggregated partial failures)
      let baseMessage = "Bulk upload failed";
      if (e instanceof Error && e.message) baseMessage = e.message;
      // Summarize first few distinct reasons if details present
      let detailSummary = "";
      const anyErr: any = e as any;
      if (anyErr?.details?.errors && Array.isArray(anyErr.details.errors)) {
        const reasons: Record<string, number> = {};
        anyErr.details.errors.forEach((er: any) => {
          const r = String(er.reason || "unknown");
          reasons[r] = (reasons[r] || 0) + 1;
        });
        const top = Object.entries(reasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([r, c]) => `${r}(${c})`)
          .join(", ");
        if (top) detailSummary = top;
      }
      const description = detailSummary
        ? `${baseMessage}. Reasons: ${detailSummary}`
        : `${baseMessage}. Check console for details.`;
      addToast({
        title: "Upload Failed",
        description,
        color: "danger",
      });
      console.log("[Directory] CSV bulk upload failed", e);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
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
          boardMember: !!form.boardMember,
          role: form.boardMember ? (form.role || "").trim() : null,
        });
        addToast({
          title: "User Updated",
          description: `${[form.firstName, form.lastName].filter(Boolean).join(" ") || form.email || "User"} updated successfully`,
          color: "success",
        });
        console.log("[Directory] User updated", { id: editing.id, ...form });
      } else {
        await createUser({
          firstName: (form.firstName || "").trim() || undefined,
          lastName: (form.lastName || "").trim() || undefined,
          email: form.email || "",
          phone: phoneToSave || "",
          boardMember: !!form.boardMember,
          role: form.boardMember ? (form.role || "").trim() : null,
        });
        addToast({
          title: "User Added",
          description: `${[form.firstName, form.lastName].filter(Boolean).join(" ") || form.email || "User"} added successfully`,
          color: "success",
        });
        console.log("[Directory] User added", { ...form });
      }
      setOpen(false);
    } catch (e) {
      console.error(e);
      addToast({ title: "Error", description: "Save failed", color: "danger" });
      console.log("[Directory] User save failed", e);
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
      setConfirmDelete(null);
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

  // edit and delete handled via modal or other admin flows; removed action buttons

  if (loading) return <div>Loading...</div>;

  return (
    <div
      className="px-4 py-4 max-w-4xl mx-auto w-full overflow-x-hidden"
      data-testid="membership-directory-root"
    >
      <DirectoryHeader
        isAdmin={isAdmin}
        onAdd={openAdd}
        onBulk={onSelectCsv}
        ref={fileInputRef}
        onFileChange={handleFile}
      />
      <DirectorySearchBar
        filter={filter}
        onFilterChange={setFilter}
        total={members.length}
        isFiltered={!!filter}
      />
      {isAdmin && (
        <div className="flex items-center justify-end mb-2">
          <Switch
            size="sm"
            isSelected={activeOnly}
            onValueChange={setActiveOnly}
            aria-label="Toggle active members only"
          >
            Active {currentYear} Only
          </Switch>
        </div>
      )}
      <MembersList
        members={
          isAdmin && activeOnly
            ? members.filter((m) => activeSet.has(m.id))
            : members
        }
        filter={filter}
        isAdmin={isAdmin}
        activeSet={activeSet}
        activeOnly={activeOnly}
        activeYear={currentYear}
        onEdit={openEdit}
        onDelete={requestDelete}
      />
      <EditMemberModal
        open={open}
        editing={editing}
        form={form}
        onChange={setForm as any}
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
      <CsvPreviewModal
        open={csvOpen}
        rows={csvRows}
        onClose={() => setCsvOpen(false)}
        onUpload={uploadCsv}
        uploading={uploading}
        progress={uploadProgress}
      />
    </div>
  );
}
