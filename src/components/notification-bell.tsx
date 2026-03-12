import { useRef, useState, useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/providers/AuthProvider";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/types/notification";

function getRelativeTime(ts: Timestamp | undefined): string {
  if (!ts) return "";
  const date = ts instanceof Timestamp ? ts.toDate() : new Date();
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    dismissNotification,
    clearAll,
  } = useNotifications(user?.uid);

  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  function calcDropdownStyle() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const panelWidth = Math.min(320, window.innerWidth - 16);
    const right = window.innerWidth - rect.right;
    // Ensure the panel doesn't go off the left edge
    const clampedRight = Math.min(right, window.innerWidth - panelWidth - 8);
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: Math.max(8, clampedRight),
      width: panelWidth,
    });
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        isIconOnly
        variant="light"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        onPress={() => {
          calcDropdownStyle();
          setOpen((s) => !s);
        }}
        className="text-default-500"
      >
        <Icon icon="lucide:bell" className="text-xl" />
      </Button>
      {unreadCount > 0 && (
        <span
          className="pointer-events-none absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center px-0.5 border-2 border-background z-10"
          aria-hidden="true"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}

      {open && (
        <div style={dropdownStyle} className="z-9999 origin-top-right">
          <div className="w-full bg-background border border-default-200 rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-default-100">
              <span className="font-semibold text-sm text-foreground">
                Notifications
              </span>
              {unreadCount > 0 && (
                <Button
                  variant="light"
                  size="sm"
                  color="primary"
                  className="text-xs h-6 min-w-0 px-2"
                  onPress={() => markAllRead()}
                >
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notification list */}
            <div
              className="max-h-80 overflow-y-auto divide-y divide-default-100"
              role="list"
              aria-live="polite"
            >
              {notifications.length === 0 ? (
                <p className="text-center text-default-400 text-sm py-10">
                  No notifications
                </p>
              ) : (
                notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={() => {
                      markRead(n.id);
                    }}
                    onNavigate={
                      n.data?.link
                        ? () => {
                            markRead(n.id);
                            setOpen(false);
                            navigate(n.data!.link!);
                          }
                        : undefined
                    }
                    onDismiss={() => dismissNotification(n.id)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-default-100 px-4 py-2 flex justify-end">
                <Button
                  variant="light"
                  size="sm"
                  color="danger"
                  className="text-xs h-6 min-w-0 px-2"
                  onPress={() => {
                    clearAll();
                    setOpen(false);
                  }}
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: AppNotification;
  onMarkRead: () => void;
  onNavigate?: () => void;
  onDismiss: () => void;
}

/**
 * A single notification row. Uses a div instead of a HeroUI Button because
 * the row contains a nested interactive dismiss button — two nested <button>
 * elements are invalid HTML. The row provides keyboard accessibility manually.
 */
function NotificationItem({
  notification: n,
  onMarkRead,
  onNavigate,
  onDismiss,
}: NotificationItemProps) {
  const handleActivate = onNavigate ?? onMarkRead;
  return (
    <div
      role="listitem"
      className={`flex items-start gap-2 px-4 py-3 transition-colors ${
        !n.read ? "bg-primary-50/40 dark:bg-primary-900/10" : ""
      } hover:bg-default-50`}
    >
      {/* Main content — clicking marks the notification as read */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Notification: ${n.title}`}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleActivate();
        }}
      >
        <p
          className={`text-sm leading-tight ${
            !n.read
              ? "font-semibold text-foreground"
              : "font-normal text-foreground-600"
          }`}
        >
          {n.title}
        </p>
        <p className="text-xs text-default-400 mt-0.5 line-clamp-2">{n.body}</p>
        <p className="text-[10px] text-default-300 mt-1">
          {getRelativeTime(n.createdAt)}
        </p>
      </div>

      {/* Dismiss button */}
      <Button
        isIconOnly
        variant="light"
        size="sm"
        aria-label="Dismiss notification"
        className="shrink-0 text-default-300 hover:text-danger mt-0.5 min-w-0 w-6 h-6"
        onClick={(e) => e.stopPropagation()}
        onPress={() => onDismiss()}
      >
        <Icon icon="lucide:x" className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
