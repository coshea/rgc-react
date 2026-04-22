import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { addToast } from "@/providers/toast";
import { UserAvatar } from "@/components/avatar";
import {
  onLookingForTeam,
  setLookingForTeamPost,
  deleteLookingForTeamPost,
  type LookingForTeamPost,
} from "@/api/tournaments";
import { getUserProfile, type UserProfilePayload } from "@/api/users";
import { useUsersMap } from "@/hooks/useUsers";

export interface LookingForTeamSectionProps {
  tournamentId: string;
  /** UID of the currently signed-in user, or null if logged out. */
  currentUserId: string | null;
  /** Whether tournament registration is currently open. */
  registrationOpen: boolean;
  /** Whether the current user already has a team registration. */
  isUserRegistered: boolean;
  /** Number of players per team — section is hidden for solo (1-player) tournaments. */
  maxTeamSize: number;
  /** Whether the viewer has admin privileges (can delete any post). */
  isAdmin?: boolean;
}

/**
 * Renders the "Looking for a team" section on the tournament detail page.
 * Users who are not yet on a team can post that they are looking to join one.
 * Posts are hidden automatically once the user joins a team.
 * Only shown while registration is open.
 */
export const LookingForTeamSection: React.FC<LookingForTeamSectionProps> = ({
  tournamentId,
  currentUserId,
  registrationOpen,
  isUserRegistered,
  maxTeamSize,
  isAdmin = false,
}) => {
  const [posts, setPosts] = useState<LookingForTeamPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Owner profile cache keyed by uid
  const [owners, setOwners] = useState<
    Record<string, (UserProfilePayload & { id: string }) | null>
  >({});

  const { usersMap } = useUsersMap();

  // Subscribe to the lookingForTeam sub-collection
  useEffect(() => {
    if (!tournamentId) return;
    const unsub = onLookingForTeam(
      tournamentId,
      (next) => {
        setPosts(next);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load looking-for-team posts", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tournamentId]);

  // Fetch owner profiles for any posts not yet cached
  const ownerIds = useMemo(
    () => Array.from(new Set(posts.map((p) => p.ownerId))),
    [posts],
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
          } catch {
            return { uid, profile: null } as const;
          }
        }),
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
  }, [ownerIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentUserHasPost = useMemo(
    () => !!currentUserId && posts.some((p) => p.ownerId === currentUserId),
    [posts, currentUserId],
  );

  const handleTogglePost = async () => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      if (currentUserHasPost) {
        await deleteLookingForTeamPost(tournamentId, currentUserId);
        addToast({
          title: "Post removed",
          description: "You are no longer listed as looking for a team.",
          color: "success",
        });
      } else {
        await setLookingForTeamPost(tournamentId, currentUserId);
        addToast({
          title: "Post created",
          description:
            "Other members can see you are looking for a team to join.",
          color: "success",
        });
      }
    } catch (err) {
      console.error(err);
      addToast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAdminDelete = async (post: LookingForTeamPost) => {
    setDeletingId(post.ownerId);
    try {
      await deleteLookingForTeamPost(tournamentId, post.ownerId);
      addToast({
        title: "Post removed",
        description: "The post has been deleted.",
        color: "success",
      });
    } catch (err) {
      console.error(err);
      addToast({
        title: "Error",
        description: "Could not delete the post.",
        color: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Derive visible posts: if the current user is now registered, hide their post
  // from the list so they don't need to manually remove it.
  const visiblePosts = useMemo(
    () =>
      isUserRegistered
        ? posts.filter((p) => p.ownerId !== currentUserId)
        : posts,
    [posts, isUserRegistered, currentUserId],
  );

  // Section hidden for solo tournaments, when registration is closed, or when logged out
  if (maxTeamSize <= 1 || !registrationOpen || !currentUserId) return null;

  const canPost = !!currentUserId && !isUserRegistered;

  return (
    <div className="mb-12">
      <Card shadow="sm">
        <CardHeader className="pb-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon
              icon="lucide:search"
              className="w-5 h-5 text-secondary-500"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold">Looking For A Team</h2>
            {!loading && visiblePosts.length > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                {visiblePosts.length}
              </span>
            )}
          </div>
          {canPost && (
            <Button
              size="sm"
              variant={currentUserHasPost ? "flat" : "solid"}
              color={currentUserHasPost ? "default" : "secondary"}
              isLoading={saving}
              onPress={handleTogglePost}
              startContent={
                !saving && (
                  <Icon
                    icon={currentUserHasPost ? "lucide:x" : "lucide:plus"}
                    className="w-4 h-4"
                    aria-hidden="true"
                  />
                )
              }
            >
              {currentUserHasPost ? "Remove my post" : "I'm looking for a team"}
            </Button>
          )}
        </CardHeader>
        <Divider className="mt-3" />
        <CardBody className="pt-4">
          {isUserRegistered && currentUserHasPost ? (
            // User just joined a team — their post is hidden but give them a prompt to clean up
            <div className="text-sm text-foreground-500 flex items-start gap-2">
              <Icon
                icon="lucide:check-circle"
                className="w-4 h-4 mt-0.5 text-success-500"
                aria-hidden="true"
              />
              <p>
                You&apos;re now registered — your post is hidden automatically.
              </p>
            </div>
          ) : loading ? (
            <p className="text-sm text-foreground-500">Loading...</p>
          ) : visiblePosts.length === 0 ? (
            <p className="text-sm text-foreground-500">
              Members who haven't found a team yet can post here. Post your own
              listing or email someone to connect.
            </p>
          ) : (
            <>
              <div className="mb-3 text-xs text-foreground-500 flex items-start gap-2">
                <Icon
                  icon="lucide:info"
                  className="w-4 h-4 mt-0.5 text-foreground-400"
                  aria-hidden="true"
                />
                <p>
                  These members are looking for a team to join. Click the email
                  icon to reach out and invite them to yours.
                </p>
              </div>
              <ul
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                aria-label="Players looking for a team"
              >
                {visiblePosts.map((post) => {
                  const profile = owners[post.ownerId];
                  const globalUser = usersMap.get(post.ownerId);
                  const displayName =
                    profile?.displayName || globalUser?.displayName || "Member";
                  const isCurrentUser = post.ownerId === currentUserId;
                  const isDeleting = deletingId === post.ownerId;

                  return (
                    <li
                      key={post.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-default-200 px-3 py-2 bg-default-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar
                          user={
                            profile
                              ? {
                                  id: profile.id,
                                  displayName: profile.displayName,
                                  profileURL: profile.profileURL ?? null,
                                  photoURL: profile.photoURL ?? null,
                                }
                              : globalUser
                          }
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {displayName}
                            {isCurrentUser && (
                              <span className="ml-1.5 text-xs font-normal text-foreground-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-foreground-400">
                            Posted{" "}
                            {post.createdAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {profile?.email && !isCurrentUser && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            as="a"
                            href={`mailto:${profile.email}`}
                            aria-label={`Email ${displayName}`}
                          >
                            <Icon
                              icon="lucide:mail"
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                          </Button>
                        )}
                        {isAdmin && !isCurrentUser && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            isLoading={isDeleting}
                            onPress={() => handleAdminDelete(post)}
                            aria-label={`Remove post for ${displayName}`}
                          >
                            {!isDeleting && (
                              <Icon
                                icon="lucide:trash-2"
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                            )}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
