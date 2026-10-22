import {
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  Switch,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import * as Sentry from "@sentry/react";
import {
  getMembershipPayment,
  updateMembershipPayment,
  deleteMembershipPayment,
  type MembershipPayment,
} from "@/api/membership";
import { useQueryClient } from "@tanstack/react-query";
import { ALLOWED_BOARD_ROLES, isAllowedBoardRole } from "@/types/roles";
import { MEMBERSHIP_TYPES } from "@@/types";
import {
  saveMemberNotificationPreferences,
  type NotificationPreferences,
  type User,
} from "@/api/users";
import { formatPhone } from "@/utils/phone";
import { resolvePreferences } from "@/utils/notificationPreferences";
import { addToast } from "@/providers/toast";
import { UserAvatar } from "@/components/avatar";
import { GoldTeeSwitch } from "@/components/profile/gold-tee-switch";
import { ShirtSizePicker } from "@/components/profile/shirt-size-picker";
import { MemberNotificationPreferences } from "./MemberNotificationPreferences";

/** Profile fields the caller saves through `onSave`. */
export type MemberForm = Record<string, unknown>;

interface EditMemberModalProps {
  open: boolean;
  editing: User | null;
  form: MemberForm;
  onChange: (next: MemberForm) => void;
  onClose: () => void;
  /** Saves the profile fields; returns the new member's id when adding. */
  onSave: () => Promise<string | undefined> | void;
  isAdmin?: boolean; // gate membership editing
}

type PaymentDraft = {
  membershipType?: string;
  amount?: string;
  method?: string;
  status?: MembershipPayment["status"];
  markPaid?: boolean;
};

const TAB = {
  DETAILS: "details",
  MEMBERSHIP: "membership",
  NOTIFICATIONS: "notifications",
} as const;

const PAYMENT_METHODS = [
  { id: "paypal", label: "PayPal" },
  { id: "check", label: "Check" },
] as const;

function text(form: MemberForm, key: string): string {
  const value = form[key];
  return typeof value === "string" ? value : "";
}

/**
 * Who you're editing, at a glance: avatar, name, email and the chips that
 * decide what they can do on the site (membership, dues, board role).
 */
function MemberSummary({ member, year }: { member: User; year: number }) {
  const name =
    [member.firstName, member.lastName].filter(Boolean).join(" ") ||
    member.displayName ||
    member.email ||
    "Member";
  const paid = (member.lastPaidYear ?? 0) >= year;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar user={member} size="lg" className="h-14 w-14 shrink-0" />
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold leading-tight">{name}</h2>
        {member.email && (
          <p className="truncate text-sm text-muted">{member.email}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {member.membershipType && (
            <Chip
              size="sm"
              variant="soft"
              color={
                member.membershipType === MEMBERSHIP_TYPES.FULL
                  ? "success"
                  : "accent"
              }
            >
              {member.membershipType === MEMBERSHIP_TYPES.FULL
                ? "Full member"
                : "Handicap member"}
            </Chip>
          )}
          <Chip size="sm" variant="soft" color={paid ? "success" : "warning"}>
            {paid ? `Paid for ${year}` : `Not paid for ${year}`}
          </Chip>
          {member.boardMember && member.role && (
            <Chip size="sm" variant="soft">
              {member.role}
            </Chip>
          )}
        </div>
      </div>
    </div>
  );
}

/** A labelled switch row with a one-line explanation under the label. */
function SwitchRow({
  label,
  description,
  isSelected,
  onChange,
  isDisabled,
}: {
  label: string;
  description: string;
  isSelected: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-label`} className="text-sm font-medium">
          {label}
        </p>
        <p id={`${id}-description`} className="text-sm text-muted">
          {description}
        </p>
      </div>
      <Switch
        isSelected={isSelected}
        onChange={onChange}
        isDisabled={isDisabled}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        className="shrink-0"
      >
        {/* Switch.Content renders the real input; the control must sit inside it. */}
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}

export function EditMemberModal({
  open,
  editing,
  form,
  onChange,
  onClose,
  onSave,
  isAdmin,
}: EditMemberModalProps) {
  const currentYear = new Date().getFullYear();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>(TAB.DETAILS);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [payment, setPayment] = useState<PaymentDraft>({});
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    resolvePreferences(editing?.notificationPreferences),
  );
  const [prefsDirty, setPrefsDirty] = useState(false);

  const set = (key: string, value: unknown) =>
    onChange({ ...form, [key]: value });
  const updatePayment = (next: Partial<PaymentDraft>) => {
    setPayment((p) => ({ ...p, ...next }));
    setPaymentDirty(true);
  };

  // Start on Details with the member's saved preferences each time it opens
  useEffect(() => {
    if (open) {
      setTab(TAB.DETAILS);
      setPrefs(resolvePreferences(editing?.notificationPreferences));
      setPrefsDirty(false);
    }
  }, [open, editing]);

  // Load existing payment record when modal opens for an existing user
  useEffect(() => {
    // Always reset confirmation state when the subject changes
    setConfirmingDelete(false);
    setDeletingPayment(false);

    if (open && editing && isAdmin) {
      setLoadingPayment(true);
      getMembershipPayment(editing.id, currentYear)
        .then((p) => {
          if (p) {
            setPayment({
              membershipType: p.membershipType ?? "",
              amount: p.amount != null ? String(p.amount) : "",
              method: p.method || "",
              status: p.status,
              markPaid: p.status === "confirmed",
            });
          } else {
            setPayment({
              membershipType: editing.membershipType || "",
              markPaid: false,
            });
          }
        })
        .finally(() => setLoadingPayment(false));
    } else if (!open) {
      setPaymentDirty(false);
      setPayment({});
    }
  }, [open, editing, isAdmin, currentYear]);

  async function handleDeletePayment() {
    if (!editing || deletingPayment) return;
    setDeletingPayment(true);
    try {
      await deleteMembershipPayment({ userId: editing.id, year: currentYear });
      qc.invalidateQueries({ queryKey: ["membershipPayments", currentYear] });
      qc.invalidateQueries({ queryKey: ["activeMembers", currentYear] });
      qc.invalidateQueries({ queryKey: ["userProfile", editing.id] });
      setPayment({});
      setPaymentDirty(false);
      setConfirmingDelete(false);
      addToast({
        title: "Payment deleted",
        description: `${currentYear} payment record removed.`,
        color: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      addToast({
        title: "Delete failed",
        description: message,
        color: "danger",
      });
    } finally {
      setDeletingPayment(false);
    }
  }

  async function handleSave() {
    if (saving) return; // guard double submit
    setSaving(true);
    try {
      // First run existing onSave for user profile
      const newUserId = await onSave();

      // Determine user ID for payment processing
      const userIdForPayment = editing?.id || newUserId;

      if (isAdmin && editing && prefsDirty) {
        try {
          await saveMemberNotificationPreferences(editing.id, prefs);
          setPrefsDirty(false);
          qc.invalidateQueries({ queryKey: ["users"] });
          qc.invalidateQueries({ queryKey: ["userProfile", editing.id] });
        } catch (prefsError) {
          Sentry.captureException(prefsError);
          addToast({
            title: "Preferences not saved",
            description:
              "Member information was saved, but their notification preferences could not be updated.",
            color: "warning",
          });
          return;
        }
      }

      if (!isAdmin || !userIdForPayment || !paymentDirty) {
        addToast({
          title: "Member saved",
          description: editing
            ? "Member information has been updated."
            : "New member has been created.",
          color: "success",
        });
        onClose();
        return; // Nothing else to do for membership payment path
      }

      try {
        const membershipType = (payment.membershipType || "").trim();
        if (
          membershipType !== MEMBERSHIP_TYPES.FULL &&
          membershipType !== MEMBERSHIP_TYPES.HANDICAP
        ) {
          setTab(TAB.MEMBERSHIP);
          addToast({
            title: "Choose a membership type",
            description: "Pick Full or Handicap on the Membership tab.",
            color: "warning",
          });
          return;
        }

        const updates: Partial<
          Pick<
            MembershipPayment,
            "amount" | "method" | "membershipType" | "status"
          >
        > = {
          membershipType,
          amount: payment.amount ? Number(payment.amount) : undefined,
          method: payment.method || undefined,
          status: payment.markPaid ? "confirmed" : "pending",
        };

        const result = await updateMembershipPayment({
          userId: userIdForPayment,
          year: currentYear,
          updates,
        });

        // Invalidate active members so UI reflects new status immediately
        if (result?.confirmed || result?.created) {
          qc.invalidateQueries({ queryKey: ["activeMembers", currentYear] });
        }

        addToast({
          title: "Member saved",
          description: result?.denormWarning
            ? "Member information and payment details have been updated, but the member's profile could not be fully synced. Please refresh and verify their membership status."
            : "Member information and payment details have been updated.",
          color: result?.denormWarning ? "warning" : "success",
        });
        onClose();
      } catch (paymentError) {
        Sentry.captureException(paymentError);
        addToast({
          title: "Payment save failed",
          description:
            "Member information was saved, but there was an error updating payment details.",
          color: "warning",
        });
      }
    } catch (userSaveError) {
      Sentry.captureException(userSaveError);
      addToast({
        title: "Save failed",
        description:
          "There was an error saving the member information. Please try again.",
        color: "danger",
      });
    } finally {
      // If save succeeded we likely closed already; safe to flip flag either way.
      setSaving(false);
    }
  }

  const role = text(form, "role");
  const boardMember = !!form.boardMember;
  const roleOptions = ALLOWED_BOARD_ROLES as readonly string[];
  const roleChoices =
    role && !roleOptions.includes(role) ? [role, ...roleOptions] : roleOptions;
  const roleError = !boardMember
    ? undefined
    : !role.trim()
      ? "Board members need a role."
      : !isAllowedBoardRole(role)
        ? "This role is no longer used. Pick a current one."
        : undefined;

  const detailsPanel = (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          value={text(form, "firstName")}
          onChange={(v) => set("firstName", v)}
          isDisabled={saving}
        >
          <Label>First name</Label>
          <Input autoComplete="off" />
        </TextField>
        <TextField
          value={text(form, "lastName")}
          onChange={(v) => set("lastName", v)}
          isDisabled={saving}
        >
          <Label>Last name</Label>
          <Input autoComplete="off" />
        </TextField>
        <TextField
          value={text(form, "email")}
          onChange={(v) => set("email", v)}
          isDisabled={saving}
        >
          <Label>Email</Label>
          <Input type="email" autoComplete="off" />
        </TextField>
        <TextField
          value={text(form, "phone")}
          onChange={(v) => set("phone", v)}
          onBlur={() => set("phone", formatPhone(text(form, "phone")))}
          isDisabled={saving}
        >
          <Label>Phone</Label>
          <Input type="tel" autoComplete="off" />
        </TextField>
        <TextField
          value={text(form, "ghinNumber")}
          onChange={(v) => set("ghinNumber", v)}
          isDisabled={saving}
        >
          <Label>GHIN number</Label>
          <Input inputMode="numeric" autoComplete="off" />
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">T-shirt size</p>
        <ShirtSizePicker
          value={text(form, "tShirtSize")}
          onChange={(size) => set("tShirtSize", size)}
        />
      </div>

      <div className="border-t border-border pt-4">
        <GoldTeeSwitch
          isSelected={!!form.defaultGoldTee}
          onChange={(value) => set("defaultGoldTee", value)}
          isDisabled={saving}
          description="Seniors only. Gold tees are pre-selected when they register or are added to a team."
        />
      </div>
    </div>
  );

  const membershipPanel = (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-semibold">
              {currentYear} membership
            </h3>
            <p className="text-sm text-muted">
              {payment.status
                ? `There's a ${payment.status} payment record for ${currentYear}.`
                : `No payment recorded for ${currentYear} yet.`}
            </p>
          </div>
          {loadingPayment ? (
            <div className="flex min-h-24 items-center justify-center">
              <Spinner size="sm" aria-label="Loading payment" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p id="member-type-label" className="text-sm font-medium">
                  Membership type
                </p>
                <ToggleButtonGroup
                  aria-labelledby="member-type-label"
                  selectionMode="single"
                  disallowEmptySelection
                  isDetached
                  isDisabled={saving}
                  selectedKeys={
                    payment.membershipType ? [payment.membershipType] : []
                  }
                  onSelectionChange={(keys) => {
                    const [next] = Array.from(keys);
                    if (next !== undefined)
                      updatePayment({ membershipType: String(next) });
                  }}
                  className="gap-1.5"
                >
                  <ToggleButton
                    id={MEMBERSHIP_TYPES.FULL}
                    className="h-11 px-4 font-semibold"
                  >
                    Full
                  </ToggleButton>
                  <ToggleButton
                    id={MEMBERSHIP_TYPES.HANDICAP}
                    className="h-11 px-4 font-semibold"
                  >
                    Handicap
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <SwitchRow
                label={`Paid for ${currentYear}`}
                description="On confirms the payment. Off keeps it pending."
                isSelected={!!payment.markPaid}
                onChange={(markPaid) => updatePayment({ markPaid })}
                isDisabled={saving}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  value={payment.amount || ""}
                  onChange={(amount) => updatePayment({ amount })}
                  isDisabled={saving}
                >
                  <Label>Amount ($)</Label>
                  <Input inputMode="decimal" />
                </TextField>
                <div className="flex flex-col gap-1">
                  <p id="member-method-label" className="text-sm font-medium">
                    Paid by
                  </p>
                  <ToggleButtonGroup
                    aria-labelledby="member-method-label"
                    selectionMode="single"
                    isDetached
                    isDisabled={saving}
                    selectedKeys={payment.method ? [payment.method] : []}
                    onSelectionChange={(keys) => {
                      const [next] = Array.from(keys);
                      updatePayment({ method: next ? String(next) : "" });
                    }}
                    className="gap-1.5"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <ToggleButton
                        key={m.id}
                        id={m.id}
                        className="h-11 px-4 font-semibold"
                      >
                        {m.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              </div>

              {editing && payment.status && (
                <div className="flex min-h-11 flex-wrap items-center gap-2">
                  {confirmingDelete ? (
                    <>
                      <span className="text-sm text-danger">
                        Delete this payment record?
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        isDisabled={deletingPayment}
                        onPress={handleDeletePayment}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isDisabled={deletingPayment}
                        onPress={() => setConfirmingDelete(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      isDisabled={saving}
                      onPress={() => setConfirmingDelete(true)}
                    >
                      <Icon icon="lucide:trash-2" className="h-4 w-4" />
                      Delete payment
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <SwitchRow
          label="Board member"
          description="Listed on the board page with their role."
          isSelected={boardMember}
          onChange={(checked) =>
            onChange({
              ...form,
              boardMember: checked,
              role: checked ? role || "Board Member" : "",
            })
          }
          isDisabled={saving}
        />
        {boardMember && (
          <Select
            placeholder="Select a role"
            value={role || undefined}
            isDisabled={saving}
            isInvalid={!!roleError}
            onChange={(key) => {
              if (key) set("role", String(key));
            }}
            className="sm:max-w-xs"
          >
            <Label>Role</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {roleChoices.map((r) => (
                  <ListBox.Item key={r} id={r} textValue={r}>
                    {r}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError>{roleError}</FieldError>
          </Select>
        )}
      </section>
    </div>
  );

  const notificationsPanel = (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Turn off anything the member asked to stop getting, like an unsubscribe
        request sent to the club inbox.
      </p>
      <MemberNotificationPreferences
        value={prefs}
        isDisabled={saving}
        onChange={(next) => {
          setPrefs(next);
          setPrefsDirty(true);
        }}
      />
    </div>
  );

  return (
    <Modal.Backdrop
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !saving) onClose();
      }}
    >
      <Modal.Container
        size="lg"
        scroll="inside"
        className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]"
      >
        <Modal.Dialog
          aria-label={editing ? "Edit member" : "Add member"}
          className="max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)]"
        >
          <Modal.Header className="flex flex-col gap-3 pb-0">
            <div className="flex items-start justify-between gap-3">
              {editing ? (
                <MemberSummary member={editing} year={currentYear} />
              ) : (
                <div>
                  <h2 className="text-lg font-semibold">Add member</h2>
                  <p className="text-sm text-muted">
                    For someone who isn&apos;t on the site yet.
                  </p>
                </div>
              )}
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="Close"
                onPress={onClose}
                isDisabled={saving}
                className="-mr-2 -mt-1 h-11 w-11 shrink-0 text-muted"
              >
                <Icon icon="lucide:x" className="h-5 w-5" />
              </Button>
            </div>
            <Tabs
              selectedKey={tab}
              onSelectionChange={(k) => setTab(String(k))}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="Member sections">
                  <Tabs.Tab id={TAB.DETAILS}>
                    Details
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  {isAdmin && (
                    <Tabs.Tab id={TAB.MEMBERSHIP}>
                      Membership
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  )}
                  {isAdmin && editing && (
                    <Tabs.Tab id={TAB.NOTIFICATIONS}>
                      Notifications
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  )}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </Modal.Header>
          <Modal.Body className="pt-4 sm:min-h-104">
            {tab === TAB.MEMBERSHIP && isAdmin
              ? membershipPanel
              : tab === TAB.NOTIFICATIONS && isAdmin && editing
                ? notificationsPanel
                : detailsPanel}
          </Modal.Body>
          <Modal.Footer className="border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="tertiary"
              onPress={onClose}
              isDisabled={saving}
              className="h-11 flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onPress={handleSave}
              isDisabled={saving || !!roleError}
              aria-busy={saving}
              className="h-11 flex-1 sm:flex-none sm:px-6"
            >
              {saving ? (
                <span className="flex items-center gap-1">
                  <Spinner size="sm" /> Saving…
                </span>
              ) : editing ? (
                "Save changes"
              ) : (
                "Add member"
              )}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
