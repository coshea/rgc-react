import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import {
  Button,
  Input,
  TextArea,
  Label,
  ListBox,
  Select,
  Chip,
  RadioGroup,
  Radio,
  DatePicker,
  TextField,
  FieldError,
} from "@heroui/react";
import { parseDateTime, getLocalTimeZone } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { Icon } from "@iconify/react";
import { functions, db } from "@/config/firebase";
import { addToast } from "@/providers/toast";
import type { User } from "@/api/users";
import type { AppNotification, NotificationType } from "@/types/notification";
import { NOTIFICATION_TYPE_META } from "@/types/notification";

interface TournamentOption {
  id: string;
  title: string;
  maxTeams?: number;
  registrationEnd?: Date;
}

interface SendNotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  targetUid?: string;
  targetTournamentId?: string;
  /** When set, only the first N registrations (ordered by registeredAt) are notified. */
  maxTeams?: number;
  /** Send to all non-migrated members NOT registered for this tournament. */
  targetNonRegistrantsTournamentId?: string;
  /** Optional ISO expiry datetime. Defaults to 60 days on the backend when omitted. */
  expiresAt?: string;
  data?: { link?: string };
}

interface SendNotificationResult {
  success: boolean;
  count: number;
}

const NOTIFICATION_TYPES = (
  Object.entries(NOTIFICATION_TYPE_META) as [
    NotificationType,
    (typeof NOTIFICATION_TYPE_META)[NotificationType],
  ][]
).map(([value, meta]) => ({ value, ...meta }));

const TYPE_COLORS: Record<
  NotificationType,
  "default" | "accent" | "success" | "warning" | "danger"
> = Object.fromEntries(
  (
    Object.entries(NOTIFICATION_TYPE_META) as [
      NotificationType,
      (typeof NOTIFICATION_TYPE_META)[NotificationType],
    ][]
  ).map(([k, v]) => [k, v.color]),
) as Record<
  NotificationType,
  "default" | "accent" | "success" | "warning" | "danger"
>;

function formatSentAt(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString();
}

function formatShortDate(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Notification types that auto-link expiration to a tournament's registration close date. */
const REGISTRATION_LINKED_TYPES = new Set<NotificationType>([
  "registration_opening",
  "registration_closing_soon",
]);

/** Notification types that are associated with a specific tournament. */
const TOURNAMENT_TYPES = new Set<NotificationType>([
  "tournament",
  "tournament_canceled",
  "registration_opening",
  "registration_closing_soon",
]);

/** Returns default title + body text for a given notification type and optional tournament name. */
function getDefaultText(
  type: NotificationType,
  tournamentName?: string,
): { title: string; body: string } {
  const name = tournamentName ?? "the tournament";
  switch (type) {
    case "tournament":
      return {
        title: `${name}`,
        body: `Check out the details and sign up for ${name}. We hope to see you there!`,
      };
    case "tournament_canceled":
      return {
        title: `${name} Canceled`,
        body: `Unfortunately, ${name} has been canceled. We apologize for any inconvenience and hope to see you at a future event.`,
      };
    case "registration_opening":
      return {
        title: `Registration Open — ${name}`,
        body: `Registration for ${name} is now open! Secure your spot before it fills up.`,
      };
    case "registration_closing_soon":
      return {
        title: `Registration Closing Soon — ${name}`,
        body: `Registration for ${name} is closing soon. Don't miss your chance to sign up!`,
      };
    case "new_features":
      return {
        title: "New Features Available",
        body: "We've made some improvements to the app. Check out what's new!",
      };
    case "announcement":
    default:
      return {
        title: "Club Announcement",
        body: "We have an important update to share with the club. Please check the app for details.",
      };
  }
}

/** Converts a Date to an ISO-like string compatible with parseDateTime (YYYY-MM-DDTHH:mm:ss). */
function toDateTimeValue(date: Date): DateValue {
  const pad = (n: number) => String(n).padStart(2, "0");
  const str =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  return parseDateTime(str);
}

export function NotificationsTab() {
  // ── Form state ───────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<NotificationType>("announcement");
  const [targetUid, setTargetUid] = useState<string>("__all__");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState<DateValue | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // ── Tournaments list (current year) for tournament-registrant targeting ──
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [_loadingTournaments, setLoadingTournaments] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [tournamentScope, setTournamentScope] = useState<
    "in-tournament" | "all"
  >("in-tournament");

  // ── Members list for recipient select ────────────────────────────────────
  const [members, setMembers] = useState<User[]>([]);
  const [_loadingMembers, setLoadingMembers] = useState(true);

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

  useEffect(() => {
    async function fetchTournaments() {
      setLoadingTournaments(true);
      try {
        const currentYear = new Date().getFullYear();
        const snap = await getDocs(
          query(
            collection(db, "tournaments"),
            where(
              "date",
              ">=",
              Timestamp.fromDate(new Date(currentYear, 0, 1)),
            ),
            where(
              "date",
              "<",
              Timestamp.fromDate(new Date(currentYear + 1, 0, 1)),
            ),
            orderBy("date", "asc"),
          ),
        );
        setTournaments(
          snap.docs.map((d) => {
            const registrationEndRaw = d.data().registrationEnd as
              | { toDate?: () => Date }
              | undefined;
            return {
              id: d.id,
              title: d.data().title || d.id,
              maxTeams:
                typeof d.data().maxTeams === "number" &&
                Number.isFinite(d.data().maxTeams) &&
                d.data().maxTeams > 0
                  ? (d.data().maxTeams as number)
                  : undefined,
              registrationEnd: registrationEndRaw?.toDate?.(),
            };
          }),
        );
      } catch (err) {
        console.error("[AdminNotifications] Failed to load tournaments:", err);
      } finally {
        setLoadingTournaments(false);
      }
    }
    fetchTournaments();
  }, []);

  // ── Recent notifications (last 30) ───────────────────────────────────────
  const [recentNotifications, setRecentNotifications] = useState<
    AppNotification[]
  >([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteNotification(id: string) {
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "notifications", id));
      setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      addToast({
        title: "Failed to delete",
        description: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  }

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
    if (
      (targetUid === "__tournament_registrants__" ||
        targetUid === "__tournament_non_registrants__") &&
      !selectedTournamentId
    )
      newErrors.tournament = "Please select a tournament.";
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

      const selectedTournament = tournaments.find(
        (t) => t.id === selectedTournamentId,
      );

      const payload: SendNotificationPayload = {
        title: title.trim(),
        body: body.trim(),
        type,
        ...(targetUid === "__tournament_registrants__"
          ? {
              targetTournamentId: selectedTournamentId,
              ...(tournamentScope === "in-tournament" &&
              selectedTournament?.maxTeams
                ? { maxTeams: selectedTournament.maxTeams }
                : {}),
            }
          : targetUid === "__tournament_non_registrants__"
            ? { targetNonRegistrantsTournamentId: selectedTournamentId }
            : targetUid !== "__all__"
              ? { targetUid }
              : {}),
        ...(link.trim() ? { data: { link: link.trim() } } : {}),
        ...(expiresAt
          ? { expiresAt: expiresAt.toDate(getLocalTimeZone()).toISOString() }
          : {}),
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
      setType("announcement");
      setTargetUid("__all__");
      setSelectedTournamentId("");
      setTournamentScope("in-tournament");
      setLink("");
      setExpiresAt(null);
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
    <div className="max-w-3xl mx-auto">
      {/* ── Compose form ──────────────────────────────────────────────── */}
      <section className="bg-surface rounded-xl p-6 mb-8 border">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Compose &amp; Send
        </h2>

        <div className="flex flex-col gap-4">
          <TextField isInvalid={Boolean(errors.title)} isRequired>
            <Label>Title</Label>
            <Input
              placeholder="Notification title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <FieldError>{errors.title}</FieldError>
          </TextField>

          <TextField isInvalid={Boolean(errors.body)} isRequired>
            <Label>Body</Label>
            <TextArea
              placeholder="Notification message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <FieldError>{errors.body}</FieldError>
          </TextField>

          <div className="flex justify-end -mt-2">
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => {
                const tournament = tournaments.find(
                  (t) => t.id === selectedTournamentId,
                );
                const defaults = getDefaultText(type, tournament?.title);
                setTitle(defaults.title);
                setBody(defaults.body);
              }}
            >
              <Icon icon="lucide:wand-2" className="text-sm" />
              Fill defaults
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              value={type}
              onChange={(key) => {
                const val = key as NotificationType;
                if (val) {
                  setType(val);
                  // When switching to a tournament-type, pre-fill link if a
                  // tournament is already selected.
                  if (TOURNAMENT_TYPES.has(val) && selectedTournamentId) {
                    if (!link) setLink(`/tournaments/${selectedTournamentId}`);
                    if (REGISTRATION_LINKED_TYPES.has(val)) {
                      const tournament = tournaments.find(
                        (t) => t.id === selectedTournamentId,
                      );
                      if (tournament?.registrationEnd) {
                        setExpiresAt(
                          toDateTimeValue(tournament.registrationEnd),
                        );
                      }
                    }
                  }
                  // Clear tournament when switching away from tournament types
                  // and no recipient-based targeting is active.
                  if (
                    !TOURNAMENT_TYPES.has(val) &&
                    targetUid !== "__tournament_registrants__" &&
                    targetUid !== "__tournament_non_registrants__"
                  ) {
                    setSelectedTournamentId("");
                  }
                }
              }}
              isInvalid={Boolean(errors.type)}
              errorMessage={errors.type}
            >
              <Label>Type</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {NOTIFICATION_TYPES.map((t) => (
                    <ListBox.Item
                      key={t.value}
                      id={t.value}
                      textValue={t.label}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon icon={t.icon} className="text-base shrink-0" />
                        {t.label}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              value={targetUid}
              onChange={(key) => {
                const val = key as string;
                if (val) {
                  setTargetUid(val);
                  const isTournamentTargeting =
                    val === "__tournament_registrants__" ||
                    val === "__tournament_non_registrants__";
                  // Clear tournament selection when switching away from all
                  // tournament-related contexts (type and recipient).
                  if (!isTournamentTargeting && !TOURNAMENT_TYPES.has(type)) {
                    setSelectedTournamentId("");
                  }
                  if (val !== "__all__" && !isTournamentTargeting) setLink("");
                }
              }}
            >
              <Label>Recipient</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="__all__" textValue="All Members">
                    All Members
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item
                    id="__tournament_registrants__"
                    textValue="Tournament Registrants"
                  >
                    <Icon icon="lucide:users" className="text-base" />
                    Tournament Registrants
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item
                    id="__tournament_non_registrants__"
                    textValue="Non-Registrants"
                  >
                    <Icon icon="lucide:user-x" className="text-base" />
                    Non-Registrants
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {members.map((m) => (
                    <ListBox.Item
                      key={m.id}
                      id={m.id}
                      textValue={m.displayName ?? m.email ?? m.id}
                    >
                      {m.displayName ?? m.email ?? m.id}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {(TOURNAMENT_TYPES.has(type) ||
            targetUid === "__tournament_registrants__" ||
            targetUid === "__tournament_non_registrants__") && (
            <>
              <Select
                placeholder="Select a tournament"
                value={selectedTournamentId || undefined}
                onChange={(key) => {
                  const val = key as string;
                  if (val) {
                    setSelectedTournamentId(val);
                    setLink(`/tournaments/${val}`);
                    if (targetUid === "__tournament_registrants__") {
                      setTournamentScope("in-tournament");
                    }
                    if (REGISTRATION_LINKED_TYPES.has(type)) {
                      const tournament = tournaments.find((t) => t.id === val);
                      if (tournament?.registrationEnd) {
                        setExpiresAt(
                          toDateTimeValue(tournament.registrationEnd),
                        );
                      }
                    }
                  }
                }}
                isInvalid={Boolean(errors.tournament)}
                errorMessage={errors.tournament}
              >
                <Label>Tournament</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {tournaments.map((t) => (
                      <ListBox.Item key={t.id} id={t.id} textValue={t.title}>
                        {t.title}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              {targetUid === "__tournament_registrants__" &&
                selectedTournamentId && (
                  <RadioGroup
                    label="Who to notify"
                    value={tournamentScope}
                    onChange={(v) =>
                      setTournamentScope(v as "in-tournament" | "all")
                    }
                    orientation="horizontal"
                    size="sm"
                  >
                    <Radio value="in-tournament">
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <Radio.Content>In tournament</Radio.Content>
                    </Radio>
                    <Radio value="all">
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <Radio.Content>All (includes waitlist)</Radio.Content>
                    </Radio>
                  </RadioGroup>
                )}
            </>
          )}

          <TextField>
            <Label>Link (optional)</Label>
            <Input
              placeholder="/tournaments/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="text-xs text-muted">
              Deep-link opened when user taps the notification.
            </p>
          </TextField>

          <DatePicker
            label="Expiration (optional)"
            value={expiresAt}
            onChange={(v: DateValue | null) => setExpiresAt(v)}
            granularity="minute"
            description="When to auto-delete this notification. Defaults to 60 days if left blank."
          />

          <div className="flex justify-end">
            <Button onPress={handleSend}>
              {!sending && <Icon icon="lucide:send" className="text-base" />}
              Send Notification
            </Button>
          </div>
        </div>
      </section>

      {/* ── Recent sent notifications ──────────────────────────────────── */}
      <section className="bg-surface rounded-xl p-6 border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">
            Recent Sent
          </h2>
          <Button variant="ghost" size="sm" onPress={refreshRecent}>
            {!loadingRecent && (
              <Icon icon="lucide:refresh-cw" className="text-sm" />
            )}
            Refresh
          </Button>
        </div>

        {loadingRecent ? (
          <p className="text-muted text-sm text-center py-6">Loading…</p>
        ) : recentNotifications.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">
            No notifications sent yet.
          </p>
        ) : (
          <div className="divide-y divide-default-100">
            {recentNotifications.map((n) => (
              <div
                key={n.id}
                className="py-3 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3"
              >
                {/* Mobile top row: chip + short date + delete */}
                <div className="flex items-center justify-between gap-2 sm:contents">
                  <Chip
                    size="sm"
                    color={TYPE_COLORS[n.type as NotificationType] ?? "default"}
                    variant="tertiary"
                    className="shrink-0 sm:mt-0.5"
                  >
                    <Icon
                      icon={
                        NOTIFICATION_TYPES.find((t) => t.value === n.type)
                          ?.icon ?? "lucide:bell"
                      }
                      className="inline-block text-xs mr-0.5"
                    />
                    {NOTIFICATION_TYPES.find((t) => t.value === n.type)
                      ?.label ?? n.type}
                  </Chip>
                  <div className="flex items-center gap-0.5 sm:hidden">
                    <span className="text-xs text-muted whitespace-nowrap">
                      {formatShortDate(n.createdAt)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="Delete notification"
                      onPress={() => handleDeleteNotification(n.id)}
                    >
                      {deletingId !== n.id && (
                        <Icon icon="lucide:trash-2" className="text-sm" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Title + body */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {n.title}
                  </p>
                  <p className="text-xs text-muted line-clamp-2 sm:line-clamp-1">
                    {n.body}
                  </p>
                </div>

                {/* Desktop-only: full date + uid + delete */}
                <div className="hidden sm:flex text-right shrink-0 flex-col items-end gap-1">
                  <p className="text-[10px] text-muted whitespace-nowrap">
                    {formatSentAt(n.createdAt)}
                  </p>
                  <p className="text-[10px] text-muted truncate max-w-[120px]">
                    {n.uid}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label="Delete notification"
                    onPress={() => handleDeleteNotification(n.id)}
                  >
                    {deletingId !== n.id && (
                      <Icon icon="lucide:trash-2" className="text-sm" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
