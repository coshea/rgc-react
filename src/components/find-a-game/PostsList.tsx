import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import { FindAGamePost, deletePartnerPost } from "@/api/find-a-game";
import { getUserProfile, type UserProfilePayload } from "@/api/users";
import { UserAvatar } from "@/components/avatar";

export interface PostsListProps {
  posts: FindAGamePost[];
  canEdit: (p: FindAGamePost) => boolean;
  onDeleted?: () => void;
  onEditRequest?: (p: FindAGamePost) => void;
}

function ymdToDate(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function PostsList({
  posts,
  canEdit,
  onDeleted,
  onEditRequest,
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

  // Inline edit removed; edits are handled via modal from parent

  const removePost = async (p: FindAGamePost) => {
    await deletePartnerPost(p.id);
    onDeleted?.();
  };

  const needPlayers = posts.filter((p) => p.type === "needPlayers");
  const needGroup = posts.filter((p) => p.type === "needGroup");

  const renderCard = (p: FindAGamePost) => (
    <Card key={p.id} shadow="sm" className="border border-default-100 h-full">
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

            {
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
            }
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

        {/* Actions (no posted datetime) */}
        <div className="flex items-center gap-2">
          {canEdit(p) && (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="flat"
                onPress={() => onEditRequest?.(p)}
                startContent={<Icon icon="lucide:edit" />}
                aria-label="Edit post"
              >
                <span className="hidden md:inline">Edit</span>
              </Button>
              <Button
                size="sm"
                color="danger"
                variant="flat"
                onPress={() => removePost(p)}
                startContent={<Icon icon="lucide:trash-2" />}
                aria-label="Delete post"
              >
                <span className="hidden md:inline">Delete</span>
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-6">
      {posts.length === 0 && (
        <div className="text-sm text-default-500">No upcoming posts.</div>
      )}

      {needPlayers.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Icon
              icon="lucide:user-plus"
              className="w-4 h-4 text-primary-500"
            />{" "}
            Need Players
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {needPlayers.map((p) => renderCard(p))}
          </div>
        </section>
      )}

      {needGroup.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Icon icon="lucide:users" className="w-4 h-4" /> Need A Group
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {needGroup.map((p) => renderCard(p))}
          </div>
        </section>
      )}
    </div>
  );
}

export default PostsList;
