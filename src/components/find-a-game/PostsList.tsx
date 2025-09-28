import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import {
  FindAGamePost,
  UpdatePostInput,
  deletePartnerPost,
  updatePartnerPost,
} from "@/api/find-a-game";
import { getUserProfile, type UserProfilePayload } from "@/api/users";
import { UserAvatar } from "@/components/avatar";

type Mode = "needPlayers" | "needGroup";

export interface PostsListProps {
  posts: FindAGamePost[];
  canEdit: (p: FindAGamePost) => boolean;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

function ymdToDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function PostsList({
  posts,
  canEdit,
  onUpdated,
  onDeleted,
}: PostsListProps) {
  // Owner profile cache keyed by uid
  const [owners, setOwners] = useState<
    Record<string, (UserProfilePayload & { id: string }) | null>
  >({});

  // Collect unique ownerIds for the current posts
  const ownerIds = useMemo(
    () => Array.from(new Set(posts.map((p) => p.ownerId))),
    [posts]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = ownerIds.filter((uid) => owners[uid] === undefined);
      if (missing.length === 0) return;
      const results = await Promise.all(
        missing.map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            return { uid, profile } as const;
          } catch (e) {
            console.error("Failed to load profile for", uid, e);
            return { uid, profile: null } as const;
          }
        })
      );
      if (cancelled) return;
      setOwners((prev) => {
        const next: Record<
          string,
          (UserProfilePayload & { id: string }) | null
        > = { ...prev };
        for (const r of results) {
          next[r.uid] = r.profile ? { id: r.uid, ...r.profile } : null;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerIds, owners]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<Mode>("needPlayers");
  const [editTime, setEditTime] = useState<string>("");
  const [editSpots, setEditSpots] = useState<string>("1");

  const startEdit = (p: FindAGamePost) => {
    setEditingId(p.id);
    setEditType(p.type as Mode);
    setEditTime(p.time || "");
    setEditSpots(String(p.openSpots ?? 1));
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (p: FindAGamePost) => {
    const updates: UpdatePostInput = {
      type: editType,
      date: p.date,
      time: editType === "needPlayers" ? editTime : undefined,
      openSpots: editType === "needPlayers" ? Number(editSpots) : undefined,
    };
    await updatePartnerPost(p.id, updates);
    setEditingId(null);
    onUpdated?.();
  };

  const removePost = async (p: FindAGamePost) => {
    await deletePartnerPost(p.id);
    onDeleted?.();
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {posts.length === 0 && (
        <div className="text-sm text-default-500">No upcoming posts.</div>
      )}
      {posts.map((p) => (
        <Card
          key={p.id}
          shadow="sm"
          className="border border-default-100 h-full"
        >
          <CardBody className="flex items-start justify-between gap-3 py-2 px-3">
            <div className="flex flex-col gap-1.5 min-w-0 w-full">
              {/* First row: date badge, type chip, and details/edit */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Prominent date badge with weekday */}
                {(() => {
                  const dt = ymdToDate(p.date);
                  const mon =
                    dt
                      ?.toLocaleString(undefined, { month: "short" })
                      .toUpperCase() || "";
                  const day = dt ? String(dt.getDate()) : "";
                  const wk =
                    dt
                      ?.toLocaleString(undefined, { weekday: "short" })
                      .toUpperCase() || "";
                  return (
                    <div className="w-16 shrink-0 rounded-md border bg-content1 text-center py-1">
                      <div className="text-[10px] tracking-wide text-default-500">
                        {wk}
                      </div>
                      <div className="text-[10px] tracking-wide text-default-500">
                        {mon}
                      </div>
                      <div className="text-lg font-semibold leading-none">
                        {day}
                      </div>
                    </div>
                  );
                })()}

                {/* Post type marker with distinct styles */}
                <Chip
                  size="sm"
                  color={p.type === "needPlayers" ? "success" : "warning"}
                  variant="solid"
                  startContent={
                    <Icon
                      icon={
                        p.type === "needPlayers"
                          ? "lucide:user-plus"
                          : "lucide:users"
                      }
                      className={
                        p.type === "needPlayers"
                          ? "w-4 h-4 text-primary-500"
                          : "w-4 h-4"
                      }
                    />
                  }
                  className="shrink-0"
                >
                  {p.type === "needPlayers" ? "Need Players" : "Need Group"}
                </Chip>

                {editingId === p.id ? (
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label="Edit type"
                      selectedKeys={[editType]}
                      onSelectionChange={(keys) =>
                        setEditType(Array.from(keys)[0] as Mode)
                      }
                      className="w-[160px]"
                    >
                      <SelectItem key="needPlayers">Need Players</SelectItem>
                      <SelectItem key="needGroup">Need a Group</SelectItem>
                    </Select>
                    {editType === "needPlayers" && (
                      <>
                        <Input
                          type="time"
                          aria-label="Edit tee time"
                          value={editTime}
                          onValueChange={setEditTime}
                          className="w-36"
                        />
                        <Select
                          aria-label="Edit open spots"
                          selectedKeys={[editSpots]}
                          onSelectionChange={(keys) =>
                            setEditSpots(String(Array.from(keys)[0] || "1"))
                          }
                          className="w-28"
                        >
                          <SelectItem key="1">1</SelectItem>
                          <SelectItem key="2">2</SelectItem>
                          <SelectItem key="3">3</SelectItem>
                        </Select>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-default-700">
                    {p.type === "needPlayers" ? (
                      <>
                        <span className="font-medium">Tee Time:</span>{" "}
                        {p.time || "-"} ·{" "}
                        <span className="font-medium">Open Spots:</span>{" "}
                        {p.openSpots ?? "-"}
                      </>
                    ) : (
                      <span>Looking to join a group</span>
                    )}
                  </div>
                )}
              </div>

              {/* Second row: Owner identity */}
              <div className="flex items-center gap-2 min-w-0 pt-0.5">
                <UserAvatar
                  size="sm"
                  user={owners[p.ownerId] || undefined}
                  userId={p.ownerId}
                />
                <div className="flex items-center gap-1 text-sm text-default-600 min-w-0">
                  <span className="truncate max-w-[200px]">
                    {owners[p.ownerId]?.displayName ||
                      owners[p.ownerId]?.email ||
                      "Member"}
                  </span>
                  {owners[p.ownerId]?.email && (
                    <Button
                      as="a"
                      size="sm"
                      isIconOnly
                      variant="light"
                      href={`mailto:${owners[p.ownerId]!.email}`}
                      aria-label="Email"
                    >
                      <Icon icon="lucide:mail" className="w-4 h-4" />
                    </Button>
                  )}
                  {owners[p.ownerId]?.phone && (
                    <Button
                      as="a"
                      size="sm"
                      isIconOnly
                      variant="light"
                      href={`tel:${String(owners[p.ownerId]!.phone).replace(/\D+/g, "")}`}
                      aria-label="Call"
                    >
                      <Icon icon="lucide:phone" className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[11px] text-default-500">
                Posted {p.createdAt.toLocaleString()}
              </div>
              {canEdit(p) &&
                (editingId === p.id ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="flat" onPress={cancelEdit}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      onPress={() => saveEdit(p)}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => startEdit(p)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      onPress={() => removePost(p)}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

export default PostsList;
