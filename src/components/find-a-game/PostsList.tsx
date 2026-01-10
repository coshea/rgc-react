import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import { FindAGamePost, deletePartnerPost } from "@/api/find-a-game";
import { getUserProfile, type UserProfilePayload } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { normalizePhone } from "@/utils/phone";

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

function formatTime12Hour(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24;

  const [hours, minutes] = time24.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time24;

  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
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

  const renderCard = (p: FindAGamePost) => {
    const dt = ymdToDate(p.date);
    const mon =
      dt?.toLocaleString(undefined, { month: "short" }).toUpperCase() || "";
    const day = dt ? String(dt.getDate()) : "";
    const wk =
      dt?.toLocaleString(undefined, { weekday: "short" }).toUpperCase() || "";
    const isNeedPlayers = p.type === "needPlayers";

    return (
      <Card
        key={p.id}
        shadow="sm"
        className="border border-default-200 h-full hover:shadow-lg hover:border-primary-200 transition-all duration-200 cursor-pointer group bg-linear-to-br from-background to-default-50"
      >
        <CardBody className="p-0 overflow-hidden">
          {/* Header with gradient background */}
          <div
            className={`px-4 py-3 ${
              isNeedPlayers
                ? "bg-linear-to-r from-primary-50 to-primary-100/50 border-b border-primary-100"
                : "bg-linear-to-r from-secondary-50 to-secondary-100/50 border-b border-secondary-100"
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Enhanced date badge */}
              <div
                className={`flex items-center gap-3 ${isNeedPlayers ? "text-primary-700" : "text-secondary-700"}`}
              >
                <div
                  className={`w-14 h-14 rounded-xl ${
                    isNeedPlayers
                      ? "bg-linear-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25"
                      : "bg-linear-to-br from-secondary-500 to-secondary-600 text-white shadow-lg shadow-secondary-500/25"
                  } flex flex-col items-center justify-center`}
                >
                  <div className="text-[9px] font-medium opacity-90">{wk}</div>
                  <div className="text-lg font-bold leading-none">{day}</div>
                  <div className="text-[8px] font-medium opacity-90">{mon}</div>
                </div>

                {/* Game details */}
                <div className="flex flex-col gap-1">
                  {isNeedPlayers ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:clock" className="w-3.5 h-3.5" />
                        <span className="text-sm font-semibold">
                          {p.time ? formatTime12Hour(p.time) : "Flexible"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Icon icon="lucide:users" className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">
                          {p.openSpots === 1
                            ? "1 spot open"
                            : `${p.openSpots || 0} spots open`}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Icon icon="lucide:search" className="w-3.5 h-3.5" />
                      <span className="text-sm font-medium">
                        Looking to join a group
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="px-4 py-3 space-y-3">
            {/* Owner info with enhanced styling */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar
                  size="md"
                  user={owners[p.ownerId] || undefined}
                  userId={p.ownerId}
                  className="ring-2 ring-default-100"
                />
                <div>
                  <div className="font-semibold text-sm text-foreground">
                    {owners[p.ownerId]?.displayName ||
                      owners[p.ownerId]?.email?.split("@")[0] ||
                      `Member (${p.ownerId.slice(0, 8)}...)`}
                  </div>
                </div>
              </div>

              {/* Contact actions */}
              <div className="flex items-center gap-1">
                {owners[p.ownerId]?.email && (
                  <Button
                    as="a"
                    size="sm"
                    isIconOnly
                    variant="flat"
                    color="primary"
                    href={`mailto:${owners[p.ownerId]!.email}`}
                    aria-label="Email"
                    className="hover:scale-110 transition-transform"
                  >
                    <Icon icon="lucide:mail" className="w-4 h-4" />
                  </Button>
                )}
                {owners[p.ownerId]?.phone && (
                  <Button
                    as="a"
                    size="sm"
                    isIconOnly
                    variant="flat"
                    color="success"
                    href={`tel:${normalizePhone(owners[p.ownerId]!.phone)}`}
                    aria-label="Call"
                    className="hover:scale-110 transition-transform"
                  >
                    <Icon icon="lucide:phone" className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Actions area */}
            {canEdit(p) && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-default-100">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => onEditRequest?.(p)}
                  startContent={<Icon icon="lucide:edit" />}
                  aria-label="Edit post"
                  className="text-xs"
                >
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  onPress={() => removePost(p)}
                  startContent={<Icon icon="lucide:trash-2" />}
                  aria-label="Delete post"
                  className="text-xs"
                >
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {posts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-r from-default-100 to-default-200 flex items-center justify-center">
            <Icon
              icon="lucide:calendar-search"
              className="w-8 h-8 text-default-400"
            />
          </div>
          <h3 className="text-lg font-semibold text-default-600 mb-2">
            No upcoming games
          </h3>
          <p className="text-sm text-default-500 max-w-sm mx-auto">
            Be the first to post a game! Click "New Post" to organize a round or
            find playing partners.
          </p>
        </div>
      )}

      {needPlayers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-primary-100">
            <div className="p-2 rounded-lg bg-linear-to-r from-primary-500 to-primary-600 text-white">
              <Icon icon="lucide:user-plus" className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-primary-700">
                Need Players
              </h4>
              <p className="text-xs text-default-500">
                Join these groups looking for more players
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {needPlayers.map((p) => renderCard(p))}
          </div>
        </section>
      )}

      {needGroup.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-secondary-100">
            <div className="p-2 rounded-lg bg-linear-to-r from-secondary-500 to-secondary-600 text-white">
              <Icon icon="lucide:users" className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-secondary-700">
                Need A Group
              </h4>
              <p className="text-xs text-default-500">
                Players looking to join existing groups
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {needGroup.map((p) => renderCard(p))}
          </div>
        </section>
      )}
    </div>
  );
}

export default PostsList;
