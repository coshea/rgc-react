import { useEffect, useState } from "react";
import { addToast } from "@/providers/toast";
import { useAuth } from "@/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import type { User } from "@/api/users";
import { isAllowedBoardRole } from "@/types/roles";
import { updateUser, deleteUser, createUser } from "@/api/users";
import { formatPhone } from "@/utils/phone";
import {
  DirectoryHeader,
  DirectorySearchBar,
  MembersList,
  EditMemberModal,
  DeleteMemberModal,
} from "@/components/membership"; // barrel export
import { useDocAdminFlag } from "@/components/membership/hooks"; // still used for immediate admin gating in header (retained until full migration)
import { useMembers } from "@/hooks/useMembers";
import { Switch } from "@heroui/react";

export default function MembershipDirectoryPage() {
  const { user, userLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const { isAdmin } = useDocAdminFlag(user); // local check for early redirect logic unchanged
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

  // search filter
  const [filter, setFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
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
      <DirectoryHeader isAdmin={isAdmin} onAdd={openAdd} />
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
    </div>
  );
}
