import { Button, Input, Select, SelectItem, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  getMembershipPayment,
  updateMembershipPayment,
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
  const [payment, setPayment] = useState<{
    membershipType?: string;
    amount?: string;
    method?: string;
    status?: string;
    markPaid?: boolean;
  }>({});

  // Load existing payment record when modal opens for an existing user
  useEffect(() => {
    if (open && editing && isAdmin) {
      setLoadingPayment(true);
      getMembershipPayment(editing.id, currentYear)
        .then((p) => {
          if (p) {
            setPayment({
              membershipType: p.membershipType,
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
          description:
            "Member information and payment details have been updated.",
          color: "success",
        });
        onClose();
      } catch (paymentError) {
        console.error(
          "[EditMemberModal] membership payment save error",
          paymentError
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-md z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">
            {editing ? "Edit Member" : "Add Member"}
          </h3>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Close"
            onPress={onClose}
            className="text-default-500"
          >
            ×
          </Button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="First Name"
              value={form.firstName || ""}
              isDisabled={saving}
              onChange={(e: any) =>
                onChange({ ...form, firstName: e.target.value })
              }
            />
            <Input
              placeholder="Last Name"
              value={form.lastName || ""}
              isDisabled={saving}
              onChange={(e: any) =>
                onChange({ ...form, lastName: e.target.value })
              }
            />
          </div>
          <Input
            placeholder="Email"
            value={form.email || ""}
            isDisabled={saving}
            onChange={(e: any) => onChange({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={form.phone || ""}
            isDisabled={saving}
            onChange={(e: any) => onChange({ ...form, phone: e.target.value })}
            onBlur={() => onChange({ ...form, phone: formatPhone(form.phone) })}
          />
          <div className="pt-2 border-t border-default-200 space-y-3">
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
                      <label className="text-xs font-medium text-default-600">
                        Role <span className="text-danger">*</span>
                      </label>
                      <Select
                        size="sm"
                        aria-label="Board Role"
                        placeholder="Select a role"
                        selectedKeys={
                          form.role ? new Set([form.role]) : new Set()
                        }
                        isDisabled={saving}
                        onSelectionChange={(keys) => {
                          const v = Array.from(keys as Set<string>)[0];
                          onChange({ ...form, role: v });
                        }}
                        className="max-w-full"
                      >
                        {options.map((r) => (
                          <SelectItem key={r} textValue={r}>
                            {r}
                          </SelectItem>
                        ))}
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
              <p className="text-[11px] text-default-500">
                Check "Board Member" to assign a role (e.g. President,
                Treasurer).
              </p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-default-200 space-y-3 text-sm">
            <h4 className="text-sm font-medium">
              Membership Payment ({currentYear})
            </h4>
            {loadingPayment ? (
              <p className="text-xs text-default-500">Loading payment…</p>
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
                    size="sm"
                    aria-label="Membership Type"
                    placeholder="Type"
                    selectedKeys={
                      payment.membershipType
                        ? new Set([payment.membershipType])
                        : new Set()
                    }
                    isDisabled={saving}
                    onSelectionChange={(keys) => {
                      const v = Array.from(keys as Set<string>)[0];
                      setPayment((p) => ({ ...p, membershipType: v }));
                      setPaymentDirty(true);
                    }}
                    className="min-w-[130px]"
                  >
                    <SelectItem key="full" textValue="Full">
                      Full
                    </SelectItem>
                    <SelectItem key="handicap" textValue="Handicap">
                      Handicap
                    </SelectItem>
                  </Select>
                  <Input
                    size="sm"
                    placeholder="Amount"
                    value={payment.amount || ""}
                    className="max-w-[100px]"
                    isDisabled={saving}
                    onChange={(e: any) => {
                      setPayment((p) => ({ ...p, amount: e.target.value }));
                      setPaymentDirty(true);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    size="sm"
                    placeholder="Method (cash / check / stripe / comp)"
                    value={payment.method || ""}
                    isDisabled={saving}
                    onChange={(e: any) => {
                      setPayment((p) => ({ ...p, method: e.target.value }));
                      setPaymentDirty(true);
                    }}
                  />
                </div>
                <p className="text-[11px] text-default-500 leading-snug">
                  Marking Paid will create/update a membership payment record
                  for {currentYear}. Leaving it unchecked keeps status pending.
                </p>
              </div>
            )}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button
            onPress={handleSave}
            color="secondary"
            isDisabled={saving}
            aria-busy={saving}
          >
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
