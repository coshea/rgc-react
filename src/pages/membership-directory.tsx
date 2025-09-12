import { useEffect, useState, useRef } from "react";
import { Button, Input, Avatar, addToast, Tooltip } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/config/firebase";
import { collection, onSnapshot, addDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import type { User } from "@/api/users";
import { updateUser, deleteUser } from "@/api/users";
import type { UserProfilePayload } from "@/api/users";
import { parseUsersCsv } from "@/services/csv";

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

  // Phone helpers: normalize to digits and format as (xxx) xxx-xxxx when possible
  function normalizePhone(value?: string) {
    if (!value) return "";
    return String(value).replace(/\D/g, "");
  }

  // CSV parsing moved to `src/services/csv.ts` (parseUsersCsv)

  function formatPhone(value?: string) {
    const digits = normalizePhone(value);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 7) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    // fallback: return original trimmed value (if any)
    return value ? String(value).trim() : "";
  }

  useEffect(() => {
    if (!loading && !userLoggedIn) {
      const next = encodeURIComponent("/membership");
      navigate(`/login?next=${next}`);
      return;
    }

    // admin detection: prefer userProfile.admin (client cache), then admin doc, then token claim
    let unsubAdminDoc: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    function init() {
      if (!user?.uid) return;

      // track three possible admin signals and OR them together
      let userAdmin = false;
      let adminDocFlag = false;
      let tokenAdmin = false;

      const userRef = doc(db, "users", user.uid);
      const unsubUser = onSnapshot(userRef, (snap) => {
        const data = snap.data();
        userAdmin = data?.admin === true;
        setIsAdmin(userAdmin || adminDocFlag || tokenAdmin);
      });

      const adminRef = doc(db, "admin", user.uid);
      const unsubAdminLocal = onSnapshot(adminRef, (snap) => {
        const data = snap.data();
        adminDocFlag = data?.isAdmin === true;
        setIsAdmin(userAdmin || adminDocFlag || tokenAdmin);
      });

      // token claim check once
      (user as any)
        .getIdTokenResult()
        .then((tr: any) => {
          tokenAdmin = tr?.claims?.admin === true;
          setIsAdmin(userAdmin || adminDocFlag || tokenAdmin);
        })
        .catch(() => {
          /* ignore */
        });

      unsubAdminDoc = () => {
        unsubUser();
        unsubAdminLocal();
      };
    }

    init();

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
          // sort alphabetically by displayName, fallback to email
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
          // Log permission errors and clear members to avoid stale view
          console.error("Users snapshot error:", err);
          if (err && (err as any).code === "permission-denied") {
            setMembers([]);
          }
        }
      );
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubAdminDoc) unsubAdminDoc();
    };
  }, [loading, user, userLoggedIn, navigate]);

  function openAdd() {
    setEditing(null);
    setForm({});
    setOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      displayName: user.displayName || "",
      email: user.email || "",
      phone: user.phone || "",
    });
    setOpen(true);
  }

  function requestDelete(user: User) {
    setConfirmDelete(user);
  }

  function onSelectCsv() {
    fileInputRef.current?.click();
  }

  function handleFile(e: any) {
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
    // clear the input so the same file can be reselected if needed
    e.target.value = null;
  }

  async function uploadCsv() {
    if (!isAdmin || csvRows.length === 0) return;
    setUploading(true);
    try {
      console.log("[Directory] Starting CSV upload", { rows: csvRows.length });
      for (const r of csvRows) {
        // r already conforms to UserProfilePayload from parseUsersCsv
        // Ensure nullable strings are empty string instead of undefined
        const docPayload: Record<string, any> = {
          displayName: r.displayName || "",
          email: r.email || "",
          phone: r.phone || "",
          ghinNumber: r.ghinNumber || "",
          photoURL: r.photoURL ?? null,
        };
        if (typeof r.active === "boolean") docPayload.active = r.active;
        if (typeof r.registered === "boolean")
          docPayload.registered = r.registered;

        await addDoc(collection(db, "users"), docPayload as any);
      }
      setCsvOpen(false);
      setCsvRows([]);
      addToast({
        title: "Upload Complete",
        description: `${csvRows.length} member${csvRows.length === 1 ? "" : "s"} imported successfully`,
        color: "success",
      });
      console.log("[Directory] CSV upload success", { count: csvRows.length });
    } catch (e) {
      console.error("CSV upload error", e);
      addToast({
        title: "Upload Failed",
        description: "One or more rows failed to import",
        color: "danger",
      });
      console.log("[Directory] CSV upload failed", e);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!isAdmin) return;
    try {
      const phoneToSave = formatPhone(form.phone);
      if (editing) {
        await updateUser(editing.id, {
          displayName: form.displayName || "",
          email: form.email || "",
          phone: phoneToSave || "",
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Membership Directory</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
            <Button onPress={onSelectCsv} variant="flat">
              Bulk Upload
            </Button>
            <Button
              color="primary"
              startContent={<PlusIcon className="w-4 h-4" />}
              onPress={openAdd}
              className="font-medium"
            >
              Add Member
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <Input
          isClearable
          size="sm"
          radius="full"
          placeholder="Search by name or email..."
          startContent={
            <MagnifyingGlassIcon className="w-4 h-4 text-default-400" />
          }
          value={filter}
          onClear={() => setFilter("")}
          onValueChange={(v: string) => setFilter(v)}
          className="sm:max-w-sm"
        />
        <div className="text-xs text-default-400">
          Showing {filter ? "filtered" : "all"} {members.length} member
          {members.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="bg-background rounded-lg shadow-sm">
        {/* desktop header only */}
        <div className="hidden md:grid items-center gap-4 p-4 border-b text-sm text-default-500 font-medium grid-cols-[2fr_4fr_2fr_2fr]">
          <div>NAME</div>
          <div>EMAIL</div>
          <div>PHONE</div>
          {isAdmin ? <div className="text-right pr-4">ACTIONS</div> : <div />}
        </div>

        <div className="divide-y">
          {members
            .filter((m) => {
              if (!filter.trim()) return true;
              const q = filter.toLowerCase();
              return (
                (m.displayName || "").toLowerCase().includes(q) ||
                (m.email || "").toLowerCase().includes(q)
              );
            })
            .map((m) => (
              <div key={m.id}>
                {/* desktop row */}
                <div className="hidden md:grid items-center gap-4 p-4 grid-cols-[2fr_4fr_2fr_2fr]">
                  <div className="flex items-center gap-4">
                    <Avatar
                      className="w-8 h-8"
                      src={(m.photoURL as string) || undefined}
                      alt={m.displayName || m.email}
                    />
                    <div className="text-sm text-default-500">
                      {m.displayName || "(no name)"}
                    </div>
                  </div>

                  <div className="text-sm text-default-500 whitespace-nowrap">
                    {m.email}
                  </div>

                  <div className="text-sm text-default-500 whitespace-nowrap">
                    {m.phone ? formatPhone(m.phone) : "—"}
                  </div>
                  {isAdmin ? (
                    <div className="flex justify-end gap-2 pr-2">
                      <Tooltip content="Edit member">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => openEdit(m)}
                          aria-label="Edit member"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4 text-default-600"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.375-9.375Z" />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete member" color="danger">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => requestDelete(m)}
                          aria-label="Delete member"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                          </svg>
                        </Button>
                      </Tooltip>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                {/* mobile stacked card */}
                <div className="block md:hidden p-4">
                  <div className="flex items-center gap-4 mb-2">
                    <Avatar
                      className="w-8 h-8"
                      src={(m.photoURL as string) || undefined}
                      alt={m.displayName || m.email}
                    />
                    <div className="text-sm text-default-500 font-medium">
                      {m.displayName || "(no name)"}
                    </div>
                  </div>
                  <div className="text-sm text-default-500 mb-1 flex items-center gap-2 whitespace-normal break-words">
                    <span className="font-medium">Email:</span>
                    <span className="block break-words whitespace-normal">
                      {m.email}
                    </span>
                  </div>
                  <div className="text-sm text-default-500">
                    <span className="font-medium">Phone: </span>
                    <span>{m.phone ? formatPhone(m.phone) : "—"}</span>
                  </div>
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <Tooltip content="Edit member">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => openEdit(m)}
                          aria-label="Edit member"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4 text-default-600"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.375-9.375Z" />
                          </svg>
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete member" color="danger">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => requestDelete(m)}
                          aria-label="Delete member"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                            <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
                          </svg>
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-md z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                {editing ? "Edit Member" : "Add Member"}
              </h3>
              <button
                className="text-default-500"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Name"
                value={form.displayName || ""}
                onChange={(e: any) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />
              <Input
                placeholder="Email"
                value={form.email || ""}
                onChange={(e: any) =>
                  setForm({ ...form, email: e.target.value })
                }
              />
              <Input
                placeholder="Phone"
                value={form.phone || ""}
                onChange={(e: any) =>
                  setForm({ ...form, phone: e.target.value })
                }
                onBlur={() =>
                  setForm({ ...form, phone: formatPhone(form.phone) })
                }
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="flat" onPress={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onPress={save} color="secondary">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-sm z-10">
            <h3 className="text-lg font-medium mb-2">Delete Member</h3>
            <p className="text-sm text-default-600 mb-4">
              Are you sure you want to permanently delete{" "}
              <span className="font-medium">
                {confirmDelete.displayName ||
                  confirmDelete.email ||
                  "this user"}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="flat" onPress={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button color="danger" onPress={confirmDeleteUser}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview Modal */}
      {csvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCsvOpen(false)}
          />
          <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-2xl z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">CSV Upload Preview</h3>
              <button
                className="text-default-500"
                onClick={() => setCsvOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="max-h-96 overflow-auto border rounded mb-4">
              <table className="w-full text-sm">
                <thead className="bg-default-50">
                  <tr>
                    {csvRows.length > 0 &&
                      Object.keys(csvRows[0]).map((k) => (
                        <th key={k} className="p-2 text-left">
                          {k}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.map((r, i) => (
                    <tr key={i} className="border-b">
                      {Object.values(r).map((v, j) => (
                        <td key={j} className="p-2 truncate max-w-xs">
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="flat" onPress={() => setCsvOpen(false)}>
                Cancel
              </Button>
              <Button onPress={uploadCsv} color="secondary">
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
