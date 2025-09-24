import { Button, Input } from "@heroui/react";
import { ALLOWED_BOARD_ROLES, isAllowedBoardRole } from "@/types/roles";
import type { User } from "@/api/users";
import { formatPhone } from "@/utils/phone";

interface EditMemberModalProps {
  open: boolean;
  editing: User | null;
  form: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditMemberModal({
  open,
  editing,
  form,
  onChange,
  onClose,
  onSave,
}: EditMemberModalProps) {
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
              onChange={(e: any) =>
                onChange({ ...form, firstName: e.target.value })
              }
            />
            <Input
              placeholder="Last Name"
              value={form.lastName || ""}
              onChange={(e: any) =>
                onChange({ ...form, lastName: e.target.value })
              }
            />
          </div>
          <Input
            placeholder="Email"
            value={form.email || ""}
            onChange={(e: any) => onChange({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={form.phone || ""}
            onChange={(e: any) => onChange({ ...form, phone: e.target.value })}
            onBlur={() => onChange({ ...form, phone: formatPhone(form.phone) })}
          />
          <div className="pt-2 border-t border-default-200 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary h-4 w-4"
                checked={!!form.boardMember}
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
                      <select
                        className="border rounded-md px-3 py-2 bg-default-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={form.role || ""}
                        onChange={(e) =>
                          onChange({ ...form, role: e.target.value })
                        }
                      >
                        <option value="" disabled>
                          Select a role
                        </option>
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
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
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={onSave} color="secondary">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
