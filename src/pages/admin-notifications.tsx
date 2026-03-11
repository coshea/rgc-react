import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { functions, db } from "@/config/firebase";
import { addToast } from "@/providers/toast";
import type { User } from "@/api/users";
import type { AppNotification, NotificationType } from "@/types/notification";


interface SendNotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  targetUid?: string;
  data?: { link?: string };
}

interface SendNotificationResult {
  success: boolean;
  count: number;
}

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: "general", label: "General" },
  { value: "tournament", label: "Tournament" },
  { value: "membership", label: "Membership" },
];

const TYPE_COLORS: Record<
  NotificationType,
  "default" | "primary" | "success" | "warning" | "danger" | "secondary"
> = {
  general: "default",
  tournament: "primary",
  membership: "success",
};

function formatSentAt(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString();
}

export default function AdminNotificationsPage() {
  // ── Form state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationType>("general");
  const [targetUid, setTargetUid] = useState<string>("__all__");
  const [link, setLink] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // ── Members list for recipient select ────────────────────────────────────
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    async function fetchMembers() {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), orderBy("displayName")),
        );
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as User)
          .filter((u) => !u.isMigrated);
        setMembers(docs);
      } catch (err) {
        console.error("[AdminNotifications] Failed to load members:", err);
      } finally {
        setLoadingMembers(false);
      }
    }
    fetchMembers();
  }, []);

  // ── Recent notifications (last 30) ───────────────────────────────────────
  const [recentNotifications, setRecentNotifications] = useState<
    AppNotification[]
  >([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  async function refreshRecent() {
    setLoadingRecent(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "notifications"),
          orderBy("createdAt", "desc"),
          limit(30),
        ),
      );
      setRecentNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification),
      );
    } catch (err) {
      console.error("[AdminNotifications] Failed to load recent:", err);
    } finally {
      setLoadingRecent(false);
    }
  }

  useEffect(() => {
    refreshRecent();
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required.";
    if (!body.trim()) newErrors.body = "Body is required.";
    if (!type) newErrors.type = "Type is required.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!validate()) return;

    setSending(true);
    try {
      const sendNotification = httpsCallable<
        SendNotificationPayload,
        SendNotificationResult
      >(functions, "send_notification");

      const payload: SendNotificationPayload = {
        title: title.trim(),
        body: body.trim(),
        type,
        ...(targetUid !== "__all__" ? { targetUid } : {}),
        ...(link.trim() ? { data: { link: link.trim() } } : {}),
      };

      const result = await sendNotification(payload);
      const { count } = result.data;

      addToast({
        title: "Notification sent",
        description:
          count === 1
            ? "Notification delivered to 1 member."
            : `Notification delivered to ${count} members.`,
        color: "success",
      });

      // Reset form
      setTitle("");
      setBody("");
      setType("general");
      setTargetUid("__all__");
      setLink("");
      setErrors({});

      // Refresh recent list
      await refreshRecent();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      addToast({
        title: "Failed to send notification",
        description: message,
        color: "danger",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="py-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Icon icon="lucide:bell" className="text-2xl text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
        </div>

        {/* ── Compose form ──────────────────────────────────────────────── */}
        <section className="bg-content1 rounded-xl p-6 mb-8 border border-default-200">
          <h2 className="text-base font-semibold text-foreground mb-4">
            Compose &amp; Send
          </h2>

          <div className="flex flex-col gap-4">
            <Input
              label="Title"
              placeholder="Notification title"
              value={title}
              onValueChange={setTitle}
              isInvalid={Boolean(errors.title)}
              errorMessage={errors.title}
              isRequired
            />

            <Textarea
              label="Body"
              placeholder="Notification message"
              value={body}
              onValueChange={setBody}
              isInvalid={Boolean(errors.body)}
              errorMessage={errors.body}
              minRows={3}
              isRequired
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Type"
                selectedKeys={[type]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as NotificationType;
                  if (val) setType(val);
                }}
                isInvalid={Boolean(errors.type)}
                errorMessage={errors.type}
              >
                {NOTIFICATION_TYPES.map((t) => (
                  <SelectItem key={t.value}>{t.label}</SelectItem>
                ))}
              </Select>

              <Select
                label="Recipient"
                isLoading={loadingMembers}
                selectedKeys={[targetUid]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val) setTargetUid(val);
                }}
              >
                <>
                  <SelectItem key="__all__">All Members</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id}>
                      {m.displayName ?? m.email ?? m.id}
                    </SelectItem>
                  ))}
                </>
              </Select>
            </div>

            <Input
              label="Link (optional)"
              placeholder="https://..."
              value={link}
              onValueChange={setLink}
              description="Deep-link opened when user taps the notification."
            />

            <div className="flex justify-end">
              <Button
                color="primary"
                isLoading={sending}
                onPress={handleSend}
                startContent={
                  !sending && <Icon icon="lucide:send" className="text-base" />
                }
              >
                Send Notification
              </Button>
            </div>
          </div>
        </section>

        {/* ── Recent sent notifications ──────────────────────────────────── */}
        <section className="bg-content1 rounded-xl p-6 border border-default-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Recent Sent
            </h2>
            <Button
              variant="light"
              size="sm"
              isLoading={loadingRecent}
              onPress={refreshRecent}
              startContent={
                !loadingRecent && (
                  <Icon icon="lucide:refresh-cw" className="text-sm" />
                )
              }
            >
              Refresh
            </Button>
          </div>

          {loadingRecent ? (
            <p className="text-default-400 text-sm text-center py-6">
              Loading…
            </p>
          ) : recentNotifications.length === 0 ? (
            <p className="text-default-400 text-sm text-center py-6">
              No notifications sent yet.
            </p>
          ) : (
            <div className="divide-y divide-default-100">
              {recentNotifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start gap-3">
                  <Chip
                    size="sm"
                    color={TYPE_COLORS[n.type] ?? "default"}
                    variant="flat"
                    className="shrink-0 mt-0.5"
                  >
                    {n.type}
                  </Chip>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {n.title}
                    </p>
                    <p className="text-xs text-default-400 line-clamp-1">
                      {n.body}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-default-300 whitespace-nowrap">
                      {formatSentAt(n.createdAt)}
                    </p>
                    <p className="text-[10px] text-default-300 truncate max-w-[120px]">
                      {n.uid}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
    </div>
  );
}
