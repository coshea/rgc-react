import { useEffect, useState } from "react";
import { Button, Input, Avatar } from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/providers/AuthProvider";
import { db } from "@/config/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import type { User } from "@/api/users";

export default function MembershipDirectoryPage() {
  const { user, userLoggedIn, loading } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<User[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  // Phone helpers: normalize to digits and format as (xxx) xxx-xxxx when possible
  function normalizePhone(value?: string) {
    if (!value) return "";
    return String(value).replace(/\D/g, "");
  }

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

  async function save() {
    if (!isAdmin) return;
    try {
      const phoneToSave = formatPhone(form.phone);
      if (editing) {
        const ref = doc(db, "users", editing.id);
        await updateDoc(ref, {
          displayName: form.displayName || "",
          email: form.email || "",
          phone: phoneToSave || "",
        });
      } else {
        await addDoc(collection(db, "users"), {
          displayName: form.displayName || "",
          email: form.email || "",
          phone: phoneToSave || "",
        });
      }
      setOpen(false);
    } catch (e) {
      console.error(e);
    }
  }

  // edit and delete handled via modal or other admin flows; removed action buttons

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Membership Directory</h1>
        {isAdmin && (
          <Button onPress={openAdd} startContent={<PlusIcon />}>
            Add Member
          </Button>
        )}
      </div>

      <div className="bg-background rounded-lg shadow-sm">
        {/* desktop header only */}
        <div className="hidden md:grid grid-cols-3 items-center gap-4 p-4 border-b text-sm text-default-500 font-medium">
          <div>NAME</div>
          <div>EMAIL</div>
          <div>PHONE</div>
        </div>

        <div className="divide-y">
          {members.map((m) => (
            <div key={m.id}>
              {/* desktop row */}
              <div className="hidden md:grid grid-cols-3 items-center gap-4 p-4">
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

                <div className="text-sm text-default-500 truncate max-w-[12rem]">
                  {m.email}
                </div>

                <div className="text-sm text-default-500">
                  {m.phone ? formatPhone(m.phone) : "—"}
                </div>
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
                <div className="text-sm text-default-500 mb-1 flex items-center gap-2">
                  <span className="font-medium">Email:</span>
                  <span className="truncate max-w-full block">{m.email}</span>
                </div>
                <div className="text-sm text-default-500">
                  <span className="font-medium">Phone: </span>
                  <span>{m.phone ? formatPhone(m.phone) : "—"}</span>
                </div>
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
    </div>
  );
}
