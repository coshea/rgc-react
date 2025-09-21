import { useEffect, useState, useRef } from "react";
import { addToast } from "@heroui/react";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/config/firebase";
import { collection, onSnapshot, addDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import type { User } from "@/api/users";
import { isAllowedBoardRole } from "@/types/roles";
import { updateUser, deleteUser, bulkCreateUsers } from "@/api/users";
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
} from "@/components/membership"; // barrel export to be created if not present (fallback to individual imports)
// preflightCsv imported via barrel if needed later

export default function MembershipDirectoryPage() {
  const { user, userLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // search filter
  const [filter, setFilter] = useState("");

  // Phone helpers moved to utils/phone.ts

  useEffect(() => {
    if (!loading && !userLoggedIn) {
      const next = encodeURIComponent("/membership");
      navigate(`/login?next=${next}`);
      return;
    }

    let unsubAdminDoc: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;

    const initAdmin = () => {
      if (!user?.uid) return;

      // Only rely on admin doc + custom claim now
      let adminDocFlag = false;
      let tokenAdmin = false;

      const adminRef = doc(db, "admin", user.uid);
      const unsubAdminLocal = onSnapshot(adminRef, (snap) => {
        const data = snap.data();
        adminDocFlag =
          data?.isAdmin === true ||
          data?.admin === true ||
          data?.admin === "true";
        setIsAdmin(adminDocFlag || tokenAdmin);
      });

      (user as any)
        .getIdTokenResult()
        .then((tr: any) => {
          tokenAdmin = tr?.claims?.admin === true;
          setIsAdmin(adminDocFlag || tokenAdmin);
        })
        .catch(() => {
          /* ignore */
        });

      unsubAdminDoc = () => {
        unsubAdminLocal();
      };
    };

    initAdmin();

    // subscribe to users collection only when authenticated (avoid permission-denied)
    if (user && userLoggedIn) {
      const usersCol = collection(db, "users");
      unsubUsers = onSnapshot(
        usersCol,
        (snap) => {
          const arr: User[] = [];
          snap.forEach((d) => {
            arr.push({ id: d.id, ...(d.data() as any) } as User);
          });
          // ensure alphabetical order (displayName fallback to email)
          arr.sort((a, b) => {
            const A = (a.displayName || a.email || "").toLowerCase();
            const B = (b.displayName || b.email || "").toLowerCase();
            if (A < B) return -1;
            if (A > B) return 1;
            return 0;
          });
          setMembers(arr);
        },
        (err) => {
          console.error("Users snapshot error:", err);
          if (err && (err as any).code === "permission-denied") {
            setMembers([]);
          }
        }
      );
    }

    return () => {
      unsubAdminDoc?.();
      unsubUsers?.();
    };
  }, [user, userLoggedIn, loading, navigate]);

  // ----- Helper Actions -----
  function openAdd() {
    setEditing(null);
    setForm({
      displayName: "",
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
      displayName: u.displayName || "",
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
    // Preflight: disallow boardMember/role in bulk CSV to match security expectations.
    const invalidBoard = csvRows.some(
      (r: any) =>
        r.boardMember === true || (typeof r.role === "string" && r.role.trim())
    );
    if (invalidBoard) {
      addToast({
        title: "Invalid CSV",
        description:
          "Bulk upload cannot assign board roles. Remove boardMember/role columns.",
        color: "warning",
      });
      return;
    }
    // Basic validation: ensure every row has a non-empty email (rules now enforce this)
    const missingEmail = csvRows.filter((r) => !r.email?.trim());
    if (missingEmail.length) {
      addToast({
        title: "Invalid CSV",
        description: `${missingEmail.length} row${missingEmail.length === 1 ? "" : "s"} missing email.`,
        color: "danger",
      });
      console.warn(
        "[Directory] CSV rows missing email, aborting bulk upload",
        missingEmail.slice(0, 5)
      );
      return;
    }
    setUploading(true);
    try {
      console.log("[Directory] Starting CSV bulk upload", {
        rows: csvRows.length,
        sample: csvRows.slice(0, 3),
        isAdmin,
      });
      const boardIntended = csvRows.filter(
        (r) => (r as any).boardMember === true || (r as any).role
      )?.length;
      if (boardIntended) {
        console.log(
          "[Directory] (diagnostic) rows contained board member intent which is stripped by preflight",
          { boardIntended }
        );
      }
      const count = await bulkCreateUsers(csvRows);
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
      addToast({
        title: "Upload Failed",
        description: "Bulk upload failed. Check console for details.",
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
          displayName: form.displayName || "",
          email: form.email || "",
          phone: phoneToSave || "",
          boardMember: !!form.boardMember,
          role: form.boardMember ? (form.role || "").trim() : null,
        });
        addToast({
          title: "User Updated",
          description: `${form.displayName || form.email || "User"} updated successfully`,
          color: "success",
        });
        console.log("[Directory] User updated", { id: editing.id, ...form });
      } else {
        await addDoc(collection(db, "users"), {
          displayName: form.displayName || "",
          email: form.email || "",
          phone: phoneToSave || "",
          boardMember: !!form.boardMember,
          role: form.boardMember ? (form.role || "").trim() : null,
        });
        addToast({
          title: "User Added",
          description: `${form.displayName || form.email || "User"} added successfully`,
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
    <div className="p-4 max-w-4xl mx-auto">
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
      <MembersList
        members={members}
        filter={filter}
        isAdmin={isAdmin}
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
      />
    </div>
  );
}
