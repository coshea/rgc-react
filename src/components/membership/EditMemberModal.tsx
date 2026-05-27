import { Button, Input, ListBox, Select, Spinner } from "@heroui/react";
import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import {
  getMembershipPayment,
  updateMembershipPayment,
  deleteMembershipPayment,
} from "@/api/membership";
import { useQueryClient } from "@tanstack/react-query";
import { ALLOWED_BOARD_ROLES, isAllowedBoardRole } from "@/types/roles";
import type { User } from "@/api/users";
import { formatPhone } from "@/utils/phone";
import { addToast } from "@/providers/toast";

interface EditMemberModalProps {
  open: boolean;
  editing: User | null;
  form: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onClose: () => void;
  onSave: () => void; // existing user save callback (name/board fields)
  isAdmin?: boolean; // gate membership editing
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
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentDirty, setPaymentDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [payment, setPayment] = useState<{
    membershipType?: string;
    amount?: string;
    method?: string;
    status?: string;
    markPaid?: boolean;
  }>({});

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
        if (membershipType !== "full" && membershipType !== "handicap") {
          addToast({
            title: "Invalid membership type",
            description:
              "Please select a valid membership type (Full or Handicap).",
            color: "warning",
          });
          return;
        }

        const updates: Partial<
          Pick<
            import("@/api/membership").MembershipPayment,
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
        console.error(
          "[EditMemberModal] membership payment save error",
          paymentError,
        );
        addToast({
          title: "Payment save failed",
          description:
            "Member information was saved, but there was an error updating payment details.",
          color: "warning",
        });
      }
    } catch (userSaveError) {
      console.error("[EditMemberModal] user save error", userSaveError);
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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-background dark:bg-default/60 rounded-lg p-6 w-full max-w-md z-10 my-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">
              {editing ? "Edit Member" : "Add Member"}
            </h3>
            {editing && (
              <p className="text-xs text-muted mt-0.5 font-mono select-all">
                {editing.id}
              </p>
            )}
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Close"
            onPress={onClose}
            className="text-muted"
          >
            ×
          </Button>
        </div>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="First Name"
              value={form.firstName || ""}
              disabled={saving}
              onChange={(e: any) =>
                onChange({ ...form, firstName: e.target.value })
              }
            />
            <Input
              placeholder="Last Name"
              value={form.lastName || ""}
              disabled={saving}
              onChange={(e: any) =>
                onChange({ ...form, lastName: e.target.value })
              }
            />
          </div>
          <Input
            placeholder="Email"
            value={form.email || ""}
            fullWidth
            disabled={saving}
            onChange={(e: any) => onChange({ ...form, email: e.target.value })}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Phone"
              value={form.phone || ""}
              disabled={saving}
              onChange={(e: any) =>
                onChange({ ...form, phone: e.target.value })
              }
              onBlur={() =>
                onChange({ ...form, phone: formatPhone(form.phone) })
              }
            />
            <Input
              placeholder="GHIN Number"
              value={form.ghinNumber || ""}
              disabled={saving}
              onChange={(e: any) =>
                onChange({ ...form, ghinNumber: e.target.value })
              }
            />
          </div>
          <div className="pt-2 border-t space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary h-4 w-4"
                checked={!!form.boardMember}
                disabled={saving}
                onChange={(e) => {
                  const checked = e.target.checked;
                  onChange({
                    ...form,
                    boardMember: checked,
                    role: checked ? form.role || "Board Member" : "",
                  });
                }}
              />
              <span>Board Member</span>
            </label>
            {form.boardMember ? (
              <div className="space-y-1">
                {(() => {
                  const ROLE_OPTIONS = ALLOWED_BOARD_ROLES as readonly string[];
                  const hasLegacy =
                    form.role && !ROLE_OPTIONS.includes(form.role);
                  const options = hasLegacy
                    ? [form.role, ...ROLE_OPTIONS]
                    : ROLE_OPTIONS;
                  return (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-foreground">
                        Role <span className="text-danger">*</span>
                      </label>
                      <Select
                        aria-label="Board Role"
                        placeholder="Select a role"
                        value={form.role || undefined}
                        isDisabled={saving}
                        onChange={(key) => {
                          if (key) onChange({ ...form, role: String(key) });
                        }}
                        className="max-w-full"
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {options.map((r) => (
                              <ListBox.Item key={r} id={r} textValue={r}>
                                {r}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      {!form.role?.trim() && (
                        <p className="text-[11px] text-danger mt-1">
                          Required for board members
                        </p>
                      )}
                      {form.role?.trim() &&
                        form.boardMember &&
                        !isAllowedBoardRole(form.role) && (
                          <p className="text-[11px] text-danger mt-1">
                            Legacy/unrecognized role, please pick a valid one.
                          </p>
                        )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                Check "Board Member" to assign a role (e.g. President,
                Treasurer).
              </p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="mt-6 pt-4 border-t space-y-3 text-sm">
            <h4 className="text-sm font-medium">
              Membership Payment ({currentYear})
            </h4>
            {loadingPayment ? (
              <p className="text-xs text-muted">Loading payment…</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="accent-primary h-4 w-4"
                      checked={!!payment.markPaid}
                      disabled={saving}
                      onChange={(e) => {
                        setPayment((p) => ({
                          ...p,
                          markPaid: e.target.checked,
                        }));
                        setPaymentDirty(true);
                      }}
                    />
                    <span>Paid / Confirmed</span>
                  </label>
                  <Select
                    aria-label="Membership Type"
                    placeholder="Type"
                    value={payment.membershipType || undefined}
                    isDisabled={saving}
                    onChange={(key) => {
                      if (key) {
                        setPayment((p) => ({
                          ...p,
                          membershipType: String(key),
                        }));
                        setPaymentDirty(true);
                      }
                    }}
                    className="min-w-[130px]"
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="full" textValue="Full">
                          Full
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="handicap" textValue="Handicap">
                          Handicap
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <Input
                    placeholder="Amount"
                    value={payment.amount || ""}
                    className="max-w-[100px]"
                    disabled={saving}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setPayment((p) => ({ ...p, amount: e.target.value }));
                      setPaymentDirty(true);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Select
                    aria-label="Payment Method"
                    placeholder="Method"
                    value={payment.method || undefined}
                    isDisabled={saving}
                    onChange={(key) => {
                      const v = key ? String(key) : "";
                      setPayment((p) => ({ ...p, method: v }));
                      setPaymentDirty(true);
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="paypal" textValue="PayPal">
                          PayPal
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="check" textValue="Check">
                          Check
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <p className="text-[11px] text-muted leading-snug">
                  Marking Paid will create/update a membership payment record
                  for {currentYear}. Leaving it unchecked keeps status pending.
                </p>
                {editing && payment.status && (
                  <div className="pt-2 border-t">
                    {confirmingDelete ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-danger">
                          Delete this payment record?
                        </span>
                        <Button
                          size="sm"
                          variant="tertiary"
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
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        isDisabled={saving}
                        onPress={() => setConfirmingDelete(true)}
                      >
                        <Icon icon="lucide:trash-2" className="w-3.5 h-3.5" />
                        Delete Payment
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="tertiary" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button onPress={handleSave} isDisabled={saving} aria-busy={saving}>
            {saving ? (
              <span className="flex items-center gap-1">
                <Spinner size="sm" /> Saving...
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
