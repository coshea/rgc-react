import { useEffect, useState } from "react";
import { Button, Input } from "@heroui/react";
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

    // subscribe to users collection
    const usersCol = collection(db, "users");
    unsubUsers = onSnapshot(usersCol, (snap) => {
      const arr: User[] = [];
      snap.forEach((d) => {
        arr.push({ id: d.id, ...(d.data() as any) } as User);
      });
      setMembers(arr);
    });

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
      if (editing) {
        const ref = doc(db, "users", editing.id);
        await updateDoc(ref, {
          displayName: form.displayName || "",
          email: form.email || "",
          phone: form.phone || "",
        });
      } else {
        await addDoc(collection(db, "users"), {
          displayName: form.displayName || "",
          email: form.email || "",
          phone: form.phone || "",
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
        <div className="grid grid-cols-12 items-center gap-4 p-4 border-b text-sm text-default-500 font-medium">
          <div className="col-span-6">NAME</div>
          <div className="col-span-4">EMAIL</div>
          <div className="col-span-2">PHONE</div>
        </div>

        <div className="divide-y">
          {members.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-12 items-center gap-4 p-4"
            >
              <div className="col-span-6">
                <div className="font-medium text-lg">
                  {m.displayName || "(no name)"}
                </div>
              </div>

              <div className="col-span-4 text-sm text-default-500">
                {m.email}
              </div>

              <div className="col-span-2 text-sm text-default-500">
                {m.phone || "—"}
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
