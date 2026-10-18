import { useEffect, useId, useState } from "react";
import {
  Button,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextArea,
  TextField,
  cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import * as Sentry from "@sentry/react";

import {
  subscribeMembershipSettings,
  updateMembershipSettings,
} from "@/api/membership";
import { listPublicDocs } from "@/api/storage";
import { useAdminFlag } from "@/components/membership/hooks";
import { useAuth } from "@/providers/AuthProvider";
import { addToast } from "@/providers/toast";
import type { MembershipSettings } from "@/types/membershipSettings";
import {
  extractFirebaseAuthError,
  reportListenerError,
} from "@/utils/firebaseErrors";

export type MembershipSettingsFormLayout = "modal" | "page";

interface MembershipSettingsFormProps {
  /** "modal" keeps the footer inside the modal; "page" uses a sticky bar. */
  layout: MembershipSettingsFormLayout;
  /** Called after a successful save or cancel (the modal closes on it). */
  onDone?: () => void;
}

interface FormState {
  registrationOpen: boolean;
  automatedMemberEmailsEnabled: boolean;
  fullPrice: string;
  socialPrice: string;
  closedMessage: string;
  membershipLetterUrl: string;
  membershipApplicationUrl: string;
}

function toFormState(settings: MembershipSettings): FormState {
  return {
    registrationOpen: settings.registrationOpen,
    automatedMemberEmailsEnabled: settings.automatedMemberEmailsEnabled === true,
    fullPrice: settings.fullMembershipPrice.toString(),
    socialPrice: settings.handicapMembershipPrice.toString(),
    closedMessage: settings.closedMessage || "",
    membershipLetterUrl: settings.membershipLetterUrl || "",
    membershipApplicationUrl: settings.membershipApplicationUrl || "",
  };
}

function hasFormChanges(form: FormState, settings: MembershipSettings): boolean {
  const saved = toFormState(settings);
  return (
    form.registrationOpen !== saved.registrationOpen ||
    form.automatedMemberEmailsEnabled !== saved.automatedMemberEmailsEnabled ||
    parseFloat(form.fullPrice) !== settings.fullMembershipPrice ||
    parseFloat(form.socialPrice) !== settings.handicapMembershipPrice ||
    form.closedMessage !== saved.closedMessage ||
    form.membershipLetterUrl !== saved.membershipLetterUrl ||
    form.membershipApplicationUrl !== saved.membershipApplicationUrl
  );
}

/**
 * Membership registration settings (config/membershipSettings). Shared by the
 * Settings modal on the membership page and the Membership tab of the admin
 * dashboard. Board members can view it; only admins can save.
 */
export function MembershipSettingsForm({
  layout,
  onDone,
}: MembershipSettingsFormProps) {
  const { user } = useAuth();
  const { isAdmin, loadingAdmin } = useAdminFlag(user);
  const isReadOnly = !loadingAdmin && !isAdmin;

  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by "Try again" to resubscribe after a listener error.
  const [subscribeAttempt, setSubscribeAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [publicDocs, setPublicDocs] = useState<
    Array<{ name: string; url: string }>
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const emailsId = useId();

  useEffect(() => {
    setLoading(true);
    setLoadFailed(false);
    const unsubscribe = subscribeMembershipSettings(
      (newSettings) => {
        setSettings(newSettings);
        setForm(toFormState(newSettings));
        setLoading(false);
      },
      (error) => {
        reportListenerError("membershipSettingsForm", error);
        addToast({
          title: "Settings unavailable",
          description:
            "Unable to load membership settings. Check your connection and try again.",
          color: "danger",
        });
        setLoadFailed(true);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [subscribeAttempt]);

  useEffect(() => {
    let isMounted = true;
    setLoadingDocs(true);

    listPublicDocs()
      .then((docs) => {
        if (!isMounted) return;
        setPublicDocs(docs);
      })
      .catch((error) => {
        console.error("Failed to load public documents:", error);
        addToast({
          title: "Documents unavailable",
          description:
            "Unable to load public documents from storage. Try again later.",
          color: "warning",
        });
        if (!isMounted) return;
        setPublicDocs([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoadingDocs(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }
  }

  if (!form && loadFailed && !loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center text-muted">
        <span>Unable to load membership settings.</span>
        <Button
          variant="secondary"
          onPress={() => setSubscribeAttempt((n) => n + 1)}
        >
          <Icon icon="lucide:refresh-cw" />
          Try again
        </Button>
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted">
        <Spinner size="sm" />
        <span>Loading membership settings...</span>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    const fullPriceNum = parseFloat(form.fullPrice);
    if (isNaN(fullPriceNum) || fullPriceNum < 0) {
      newErrors.fullPrice = "Must be a valid non-negative number";
    }

    const socialPriceNum = parseFloat(form.socialPrice);
    if (isNaN(socialPriceNum) || socialPriceNum < 0) {
      newErrors.socialPrice = "Must be a valid non-negative number";
    }

    if (!form.registrationOpen && !form.closedMessage.trim()) {
      newErrors.closedMessage = "Required when registration is closed";
    }

    if (publicDocs.length > 0 && !form.membershipLetterUrl.trim()) {
      newErrors.membershipLetterUrl = "Select a membership letter document";
    }

    if (publicDocs.length > 0 && !form.membershipApplicationUrl.trim()) {
      newErrors.membershipApplicationUrl =
        "Select a membership application document";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (isReadOnly || !validateForm()) return;

    setSaving(true);
    try {
      await Sentry.startSpan(
        { name: "updateMembershipSettings", op: "ui.submit" },
        () =>
          updateMembershipSettings({
            registrationOpen: form.registrationOpen,
            automatedMemberEmailsEnabled: form.automatedMemberEmailsEnabled,
            fullMembershipPrice: parseFloat(form.fullPrice),
            handicapMembershipPrice: parseFloat(form.socialPrice),
            closedMessage: form.closedMessage.trim() || undefined,
            membershipLetterUrl: form.membershipLetterUrl.trim() || undefined,
            membershipApplicationUrl:
              form.membershipApplicationUrl.trim() || undefined,
          }),
      );

      addToast({
        title: "Settings Updated",
        description: "Membership settings have been saved successfully",
        color: "success",
      });

      onDone?.();
    } catch (error) {
      Sentry.captureException(error);
      if (extractFirebaseAuthError(error)?.code === "permission-denied") {
        addToast({
          title: "Access Denied",
          description: "You do not have permission to perform this action.",
          color: "danger",
        });
      } else {
        addToast({
          title: "Error",
          description: "Failed to update membership settings",
          color: "danger",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setForm(toFormState(settings));
    }
    setErrors({});
    onDone?.();
  };

  const hasChanges = settings ? hasFormChanges(form, settings) : false;

  const withExternalSelection = (url: string) =>
    url && !publicDocs.some((doc) => doc.url === url)
      ? [{ name: "Current selection (external)", url }, ...publicDocs]
      : publicDocs;
  const membershipLetterOptions = withExternalSelection(
    form.membershipLetterUrl,
  );
  const membershipApplicationOptions = withExternalSelection(
    form.membershipApplicationUrl,
  );

  return (
    <div className="flex flex-col">
      <div className={cn("space-y-6", layout === "modal" && "p-6")}>
        {isReadOnly && (
          <div
            role="note"
            className="flex items-start gap-2 rounded-lg border border-border bg-surface-secondary p-3 text-sm text-muted"
          >
            <Icon icon="lucide:lock" className="mt-0.5 shrink-0" />
            Only admins can change membership settings.
          </div>
        )}

        {/* Registration Toggle */}
        <div className="flex items-center justify-between gap-4 rounded-lg bg-default/60 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">Registration Status</h3>
            <p className="mt-1 text-sm text-muted">
              {form.registrationOpen
                ? "Members can register or renew their membership"
                : "Registration is closed - members will see a message"}
            </p>
          </div>
          <Switch
            isSelected={form.registrationOpen}
            onChange={(value) => update("registrationOpen", value)}
            isDisabled={isReadOnly}
            size="lg"
            aria-label="Toggle registration status"
            className="shrink-0"
          >
            {/* Switch.Content renders the real input; the control must sit inside it. */}
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="flex items-center gap-2">
                <Icon
                  icon={
                    form.registrationOpen
                      ? "lucide:check-circle"
                      : "lucide:alert-circle"
                  }
                  width={20}
                  height={20}
                  className={
                    form.registrationOpen ? "text-success" : "text-warning"
                  }
                />
                <span className="font-semibold">
                  {form.registrationOpen ? "Open" : "Closed"}
                </span>
              </span>
            </Switch.Content>
          </Switch>
        </div>

        {/* Automated member emails (feature flag read by Cloud Functions) */}
        <div className="flex items-center justify-between gap-4 rounded-lg bg-default/60 p-4">
          <div className="min-w-0 flex-1">
            <h3 id={`${emailsId}-label`} className="text-lg font-semibold">
              Automated Member Emails
            </h3>
            <p id={`${emailsId}-description`} className="mt-1 text-sm text-muted">
              {form.automatedMemberEmailsEnabled
                ? "Paid members get an email when tournament registration opens, unless they turned off tournament update emails."
                : "No member emails are sent. Admins still get the registration-opening email."}{" "}
              Turn this off before pausing the Resend subscription.
            </p>
          </div>
          <Switch
            isSelected={form.automatedMemberEmailsEnabled}
            onChange={(value) => update("automatedMemberEmailsEnabled", value)}
            isDisabled={isReadOnly}
            size="lg"
            aria-labelledby={`${emailsId}-label`}
            aria-describedby={`${emailsId}-description`}
            className="shrink-0"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="font-semibold">
                {form.automatedMemberEmailsEnabled ? "On" : "Off"}
              </span>
            </Switch.Content>
          </Switch>
        </div>

        {/* Pricing */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Membership Pricing</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Full Membership Price</Label>
              <InputGroup>
                <InputGroup.Prefix>
                  <span className="px-1 text-sm text-muted">$</span>
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder="100"
                  value={form.fullPrice}
                  onChange={(e) => update("fullPrice", e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  readOnly={isReadOnly}
                  aria-label="Full membership price"
                  aria-invalid={!!errors.fullPrice}
                />
              </InputGroup>
              {errors.fullPrice && (
                <p className="text-xs text-danger">{errors.fullPrice}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-sm">Handicap Index Price</Label>
              <InputGroup>
                <InputGroup.Prefix>
                  <span className="px-1 text-sm text-muted">$</span>
                </InputGroup.Prefix>
                <InputGroup.Input
                  placeholder="50"
                  value={form.socialPrice}
                  onChange={(e) => update("socialPrice", e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  readOnly={isReadOnly}
                  aria-label="Handicap index price"
                  aria-invalid={!!errors.socialPrice}
                />
              </InputGroup>
              {errors.socialPrice && (
                <p className="text-xs text-danger">{errors.socialPrice}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Membership Letter</h3>
          <p className="text-sm text-muted">
            Choose the PDF shown to members. Documents are loaded from the
            storage folder <span className="font-medium">public-docs</span>.
          </p>
          <TextField isInvalid={!!errors.membershipLetterUrl}>
            <Select
              value={form.membershipLetterUrl || undefined}
              onChange={(key) =>
                update("membershipLetterUrl", key ? String(key) : "")
              }
              isDisabled={loadingDocs || isReadOnly}
              placeholder={
                loadingDocs
                  ? "Loading documents..."
                  : "Select a membership letter"
              }
            >
              <Label>Membership letter document</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {membershipLetterOptions.map((doc) => (
                    <ListBox.Item
                      key={doc.url}
                      id={doc.url}
                      textValue={doc.name}
                    >
                      {doc.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <FieldError>{errors.membershipLetterUrl}</FieldError>
          </TextField>
          <TextField value={form.membershipLetterUrl}>
            <Label>Selected URL</Label>
            <Input readOnly />
          </TextField>
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">New Member Application PDF</h3>
          <p className="text-sm text-muted">
            Choose the PDF new applicants must download and mail in. Documents
            are loaded from the storage folder{" "}
            <span className="font-medium">public-docs</span>.
          </p>
          <TextField isInvalid={!!errors.membershipApplicationUrl}>
            <Select
              value={form.membershipApplicationUrl || undefined}
              onChange={(key) =>
                update("membershipApplicationUrl", key ? String(key) : "")
              }
              isDisabled={loadingDocs || isReadOnly}
              placeholder={
                loadingDocs
                  ? "Loading documents..."
                  : "Select an application PDF"
              }
            >
              <Label>Application document</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {membershipApplicationOptions.map((doc) => (
                    <ListBox.Item
                      key={doc.url}
                      id={doc.url}
                      textValue={doc.name}
                    >
                      {doc.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <FieldError>{errors.membershipApplicationUrl}</FieldError>
          </TextField>
          <TextField value={form.membershipApplicationUrl}>
            <Label>Selected URL</Label>
            <Input readOnly />
          </TextField>
        </div>

        {/* Closed Message */}
        {!form.registrationOpen && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              Closed Registration Message
            </h3>
            <p className="text-sm text-muted">
              This message will be displayed to members when registration is
              closed
            </p>
            <TextField isInvalid={!!errors.closedMessage}>
              <TextArea
                placeholder="Registration for the current year is closed. Please check back next year."
                value={form.closedMessage}
                onChange={(e) => update("closedMessage", e.target.value)}
                readOnly={isReadOnly}
                aria-label="Closed registration message"
                rows={3}
              />
              <FieldError>{errors.closedMessage}</FieldError>
            </TextField>
          </div>
        )}

        {/* Last Updated Info */}
        {settings?.updatedAt && (
          <div className="border-t border-divider pt-4">
            <p className="text-sm text-muted">
              Last updated:{" "}
              {new Date(
                typeof settings.updatedAt === "object" &&
                  "toDate" in settings.updatedAt
                  ? settings.updatedAt.toDate()
                  : settings.updatedAt,
              ).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {!isReadOnly && (
        <div
          className={cn(
            "flex items-center justify-end gap-3 bg-surface",
            layout === "modal"
              ? "sticky bottom-0 border-t border-divider p-6"
              : "sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:px-0",
          )}
        >
          <Button
            variant="tertiary"
            onPress={handleCancel}
            isDisabled={saving || (layout === "page" && !hasChanges)}
            className={cn(layout === "page" && "flex-1 sm:flex-none")}
          >
            {layout === "page" ? "Discard Changes" : "Cancel"}
          </Button>
          <Button
            onPress={handleSave}
            isDisabled={!hasChanges || saving}
            className={cn(layout === "page" && "flex-1 sm:flex-none")}
          >
            {!saving && <Icon icon="lucide:save" width={18} height={18} />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
