import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Chip,
  Button,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { Icon } from "@iconify/react";
import { useAuth } from "@/providers/AuthProvider";
import {
  CreatePostInput,
  FindAGamePost,
  createPartnerPost,
  onFuturePosts,
  toYMD,
  updatePartnerPost,
} from "@/api/find-a-game";
import { type Mode } from "@/components/find-a-game/FindAGamePostModal";
import PostsList from "@/components/find-a-game/PostsList";
import FindAGamePostModal from "@/components/find-a-game/FindAGamePostModal";
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
  const [createOpen, setCreateOpen] = useState(false);
  const { isAdmin } = useDocAdminFlag(user);

  // Edit modal state (separate from create)
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Mode>("needPlayers");
  const [editDate, setEditDate] = useState<string>(toYMD(new Date()));
  const [editTime, setEditTime] = useState<string>("");
  const [editOpenSpots, setEditOpenSpots] = useState<string>("1");
  const [savingEdit, setSavingEdit] = useState(false);

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
      // safely unsubscribe if listener was set
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (!userLoggedIn) return false;
    if (!date) return false;
    if (mode === "needPlayers") {
      return Number(openSpots) >= 1 && Number(openSpots) <= 3;
    }
    return true;
  }, [date, mode, openSpots, userLoggedIn]);

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
        time: mode === "needPlayers" ? time || undefined : undefined,
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

  const onEditRequest = (p: FindAGamePost) => {
    setEditId(p.id);
    setEditMode(p.type as Mode);
    setEditDate(p.date);
    setEditTime(p.time || "");
    setEditOpenSpots(String(p.openSpots ?? 1));
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    try {
      setSavingEdit(true);
      await updatePartnerPost(editId, {
        type: editMode,
        date: editDate,
        time: editMode === "needPlayers" ? editTime || undefined : undefined,
        openSpots:
          editMode === "needPlayers" ? Number(editOpenSpots) : undefined,
      });
      addToast({
        title: "Updated",
        description: "Post updated.",
        color: "success",
      });
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      addToast({
        title: "Error",
        description: "Could not update post.",
        color: "danger",
      });
    } finally {
      setSavingEdit(false);
    }
  };

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
        <CardHeader className="flex items-center justify-between pb-2">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Icon icon="lucide:calendar" className="w-4 h-4" /> Upcoming posts
            </h3>
            {!userLoggedIn ? (
              <Chip size="sm" variant="flat" color="warning">
                You must be logged in to post
              </Chip>
            ) : null}
          </div>
          <Button
            color="primary"
            isDisabled={!userLoggedIn}
            onPress={() => setCreateOpen(true)}
            startContent={<Icon icon="lucide:plus" className="w-4 h-4" />}
          >
            New Post
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          <PostsList
            posts={posts}
            canEdit={canEditPost}
            onEditRequest={onEditRequest}
          />
        </CardBody>
        <CardFooter>
          <div className="text-[11px] text-default-500">
            Please update or delete your post if plans change. Admins may remove
            stale content.
          </div>
        </CardFooter>
      </Card>

      <FindAGamePostModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        mode={mode}
        onModeChange={setMode}
        date={date}
        onDateChange={setDate}
        time={time}
        onTimeChange={setTime}
        openSpots={openSpots}
        onOpenSpotsChange={setOpenSpots}
        canSubmit={canSubmit}
        creating={creating}
        onSubmit={async () => {
          await handleCreate();
          setCreateOpen(false);
        }}
      />

      <FindAGamePostModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Post"
        submitLabel="Save"
        mode={editMode}
        onModeChange={setEditMode}
        date={editDate}
        onDateChange={setEditDate}
        time={editTime}
        onTimeChange={setEditTime}
        openSpots={editOpenSpots}
        onOpenSpotsChange={setEditOpenSpots}
        canSubmit={
          editMode === "needPlayers"
            ? Number(editOpenSpots) >= 1 && Number(editOpenSpots) <= 3
            : !!editDate
        }
        creating={savingEdit}
        onSubmit={handleSaveEdit}
      />
    </div>
  );
}
