import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardBody, CardFooter, Chip } from "@heroui/react";
import { addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/AuthProvider";
import {
  CreatePostInput,
  FindAGamePost,
  createPartnerPost,
  onFuturePosts,
  toYMD,
} from "@/api/find-a-game";
import CreateControls, { Mode } from "@/components/find-a-game/CreateControls";
import PostsList from "@/components/find-a-game/PostsList";
import { useDocAdminFlag } from "@/components/membership/hooks";

export default function FindAGamePage() {
  const { userLoggedIn } = useAuth();
  const [mode, setMode] = useState<Mode>("needPlayers");
  const [date, setDate] = useState<string>(() =>
    toYMD(new Date(Date.now() + 24 * 60 * 60 * 1000))
  ); // default tomorrow
  const [time, setTime] = useState<string>("");
  const [openSpots, setOpenSpots] = useState<string>("1");
  const [creating, setCreating] = useState(false);
  const [posts, setPosts] = useState<FindAGamePost[]>([]);
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  useEffect(() => {
    // Keep create date clamped to today for the form, but list shows ALL future posts
    const today = toYMD(new Date());
    if (date < today) setDate(today);
    let unsub: undefined | (() => void);
    (async () => {
      unsub = await onFuturePosts(setPosts, (e) => {
        console.error(e);
      });
    })();
    return () => {
      try {
        unsub?.();
      } catch (_) {}
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (!userLoggedIn) return false;
    if (!date) return false;
    if (mode === "needPlayers") {
      return !!time && Number(openSpots) >= 1 && Number(openSpots) <= 3;
    }
    return true;
  }, [date, mode, openSpots, time, userLoggedIn]);

  const handleCreate = async () => {
    if (!userLoggedIn) {
      addToast({
        title: "Please log in",
        description: "You must be logged in to post.",
        color: "warning",
      });
      return;
    }
    try {
      setCreating(true);
      const payload: CreatePostInput = {
        type: mode,
        date,
        time: mode === "needPlayers" ? time : undefined,
        openSpots: mode === "needPlayers" ? Number(openSpots) : undefined,
      };
      await createPartnerPost(payload);
      addToast({
        title: "Posted",
        description: "Your post is live for the selected date.",
        color: "success",
      });
      if (mode === "needPlayers") {
        setTime("");
        setOpenSpots("1");
      }
    } catch (e) {
      console.error(e);
      addToast({
        title: "Error",
        description: "Could not create post",
        color: "danger",
      });
    } finally {
      setCreating(false);
    }
  };

  const canEditPost = (p: FindAGamePost) =>
    userLoggedIn && (user?.uid === p.ownerId || isAdmin);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Find a Game</h1>
        <p className="text-default-600 text-sm">
          Post that you're looking for partners or a group, or browse posts for
          a future date.
        </p>
      </header>

      <Card shadow="sm">
        <CardHeader className="flex flex-col gap-3 pb-2">
          <CreateControls
            mode={mode}
            onModeChange={setMode}
            date={date}
            onDateChange={setDate}
            minDate={toYMD(new Date())}
            time={time}
            onTimeChange={setTime}
            openSpots={openSpots}
            onOpenSpotsChange={setOpenSpots}
            canSubmit={canSubmit}
            creating={creating}
            onSubmit={handleCreate}
          />
          {!userLoggedIn && (
            <Chip size="sm" variant="flat" color="warning">
              You must be logged in to post
            </Chip>
          )}
        </CardHeader>
        <CardBody className="space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Icon icon="lucide:calendar" className="w-4 h-4" /> Upcoming posts
          </h3>
          <PostsList posts={posts} canEdit={canEditPost} />
        </CardBody>
        <CardFooter>
          <div className="text-[11px] text-default-500">
            Please update or delete your post if plans change. Admins may remove
            stale content.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
