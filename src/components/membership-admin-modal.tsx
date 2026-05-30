import { useState, useEffect } from "react";
import {
  Button,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  updateMembershipSettings,
  subscribeMembershipSettings,
} from "@/api/membership";
import { listPublicDocs } from "@/api/storage";
import type { MembershipSettings } from "@/types/membershipSettings";
import { addToast } from "@/providers/toast";

interface MembershipAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MembershipAdminModal({
  isOpen,
  onClose,
}: MembershipAdminModalProps) {
  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [fullPrice, setFullPrice] = useState("100");
  const [socialPrice, setSocialPrice] = useState("50");
  const [closedMessage, setClosedMessage] = useState("");
  const [membershipLetterUrl, setMembershipLetterUrl] = useState("");
  const [membershipApplicationUrl, setMembershipApplicationUrl] = useState("");
  const [publicDocs, setPublicDocs] = useState<
    Array<{ name: string; url: string }>
  >([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Subscribe to membership settings
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeMembershipSettings(
      (newSettings) => {
        setSettings(newSettings);
        setRegistrationOpen(newSettings.registrationOpen);
        setFullPrice(newSettings.fullMembershipPrice.toString());
        setSocialPrice(newSettings.handicapMembershipPrice.toString());
        setClosedMessage(newSettings.closedMessage || "");
        setMembershipLetterUrl(newSettings.membershipLetterUrl || "");
        setMembershipApplicationUrl(newSettings.membershipApplicationUrl || "");
        setLoading(false);
      },
      (error) => {
        console.error("Failed to subscribe to membership settings:", error);
        addToast({
          title: "Settings unavailable",
          description:
            "Unable to load membership settings. Check your connection and try again.",
          color: "danger",
        });
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    const fullPriceNum = parseFloat(fullPrice);
    if (isNaN(fullPriceNum) || fullPriceNum < 0) {
      newErrors.fullPrice = "Must be a valid non-negative number";
    }

    const socialPriceNum = parseFloat(socialPrice);
    if (isNaN(socialPriceNum) || socialPriceNum < 0) {
      newErrors.socialPrice = "Must be a valid non-negative number";
    }

    if (!registrationOpen && !closedMessage.trim()) {
      newErrors.closedMessage = "Required when registration is closed";
    }

    if (publicDocs.length > 0 && !membershipLetterUrl.trim()) {
      newErrors.membershipLetterUrl = "Select a membership letter document";
    }

    if (publicDocs.length > 0 && !membershipApplicationUrl.trim()) {
      newErrors.membershipApplicationUrl =
        "Select a membership application document";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await updateMembershipSettings({
        registrationOpen,
        fullMembershipPrice: parseFloat(fullPrice),
        handicapMembershipPrice: parseFloat(socialPrice),
        closedMessage: closedMessage.trim() || undefined,
        membershipLetterUrl: membershipLetterUrl.trim() || undefined,
        membershipApplicationUrl: membershipApplicationUrl.trim() || undefined,
      });

      addToast({
        title: "Settings Updated",
        description: "Membership settings have been saved successfully",
        color: "success",
      });

      onClose();
    } catch (error) {
      console.error("Error updating settings:", error);
      addToast({
        title: "Error",
        description: "Failed to update membership settings",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setRegistrationOpen(settings.registrationOpen);
      setFullPrice(settings.fullMembershipPrice.toString());
      setSocialPrice(settings.handicapMembershipPrice.toString());
      setClosedMessage(settings.closedMessage || "");
      setMembershipLetterUrl(settings.membershipLetterUrl || "");
      setMembershipApplicationUrl(settings.membershipApplicationUrl || "");
      setErrors({});
    }
    onClose();
  };

  if (!isOpen) return null;

  const hasChanges =
    settings &&
    (registrationOpen !== settings.registrationOpen ||
      parseFloat(fullPrice) !== settings.fullMembershipPrice ||
      parseFloat(socialPrice) !== settings.handicapMembershipPrice ||
      closedMessage !== (settings.closedMessage || "") ||
      membershipLetterUrl !== (settings.membershipLetterUrl || "") ||
      membershipApplicationUrl !== (settings.membershipApplicationUrl || ""));

  const membershipLetterOptions =
    membershipLetterUrl &&
    !publicDocs.some((doc) => doc.url === membershipLetterUrl)
      ? [
          { name: "Current selection (external)", url: membershipLetterUrl },
          ...publicDocs,
        ]
      : publicDocs;

  const membershipApplicationOptions =
    membershipApplicationUrl &&
    !publicDocs.some((doc) => doc.url === membershipApplicationUrl)
      ? [
          {
            name: "Current selection (external)",
            url: membershipApplicationUrl,
          },
          ...publicDocs,
        ]
      : publicDocs;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleCancel}
    >
      <div
        className="bg-surface rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider sticky top-0 bg-surface z-10">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Icon
              icon="lucide:settings"
              width={24}
              height={24}
              className="text-accent"
            />
            Membership Registration Settings
          </h2>
          <Button
            isIconOnly
            variant="tertiary"
            onPress={handleCancel}
            aria-label="Close modal"
          >
            <Icon icon="lucide:x" width={20} height={20} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted justify-center py-8">
              <Icon
                icon="lucide:loader-2"
                className="animate-spin"
                width={20}
                height={20}
              />
              <span>Loading membership settings...</span>
            </div>
          ) : (
            <>
              {/* Registration Toggle */}
              <div className="flex items-center justify-between p-4 bg-default/60 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Registration Status</h3>
                  <p className="text-sm text-muted mt-1">
                    {registrationOpen
                      ? "Members can register or renew their membership"
                      : "Registration is closed - members will see a message"}
                  </p>
                </div>
                <Switch
                  isSelected={registrationOpen}
                  onChange={setRegistrationOpen}
                  size="lg"
                  aria-label="Toggle registration status"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    {registrationOpen ? (
                      <span className="flex items-center gap-2">
                        <Icon
                          icon="lucide:check-circle"
                          width={20}
                          height={20}
                          className="text-success"
                        />
                        <span className="font-semibold">Open</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Icon
                          icon="lucide:alert-circle"
                          width={20}
                          height={20}
                          className="text-warning"
                        />
                        <span className="font-semibold">Closed</span>
                      </span>
                    )}
                  </Switch.Content>
                </Switch>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Membership Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <Label className="text-sm">Full Membership Price</Label>
                    <InputGroup>
                      <InputGroup.Prefix>
                        <span className="text-muted text-sm px-1">$</span>
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="100"
                        value={fullPrice}
                        onChange={(e) => {
                          setFullPrice(e.target.value);
                          if (errors.fullPrice) {
                            setErrors((prev) => ({ ...prev, fullPrice: "" }));
                          }
                        }}
                        type="number"
                        step="0.01"
                        min="0"
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
                        <span className="text-muted text-sm px-1">$</span>
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="50"
                        value={socialPrice}
                        onChange={(e) => {
                          setSocialPrice(e.target.value);
                          if (errors.socialPrice) {
                            setErrors((prev) => ({ ...prev, socialPrice: "" }));
                          }
                        }}
                        type="number"
                        step="0.01"
                        min="0"
                        aria-invalid={!!errors.socialPrice}
                      />
                    </InputGroup>
                    {errors.socialPrice && (
                      <p className="text-xs text-danger">
                        {errors.socialPrice}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Membership Letter</h3>
                <p className="text-sm text-muted">
                  Choose the PDF shown to members. Documents are loaded from the
                  storage folder{" "}
                  <span className="font-medium">public-docs</span>.
                </p>
                <TextField isInvalid={!!errors.membershipLetterUrl}>
                  <Select
                    value={membershipLetterUrl || undefined}
                    onChange={(key) => {
                      const value = key ? String(key) : "";
                      setMembershipLetterUrl(value);
                      if (errors.membershipLetterUrl) {
                        setErrors((prev) => ({
                          ...prev,
                          membershipLetterUrl: "",
                        }));
                      }
                    }}
                    isDisabled={loadingDocs}
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
                <TextField value={membershipLetterUrl}>
                  <Label>Selected URL</Label>
                  <Input readOnly />
                </TextField>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-lg">
                  New Member Application PDF
                </h3>
                <p className="text-sm text-muted">
                  Choose the PDF new applicants must download and mail in.
                  Documents are loaded from the storage folder{" "}
                  <span className="font-medium">public-docs</span>.
                </p>
                <TextField isInvalid={!!errors.membershipApplicationUrl}>
                  <Select
                    value={membershipApplicationUrl || undefined}
                    onChange={(key) => {
                      const value = key ? String(key) : "";
                      setMembershipApplicationUrl(value);
                      if (errors.membershipApplicationUrl) {
                        setErrors((prev) => ({
                          ...prev,
                          membershipApplicationUrl: "",
                        }));
                      }
                    }}
                    isDisabled={loadingDocs}
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
                <TextField value={membershipApplicationUrl}>
                  <Label>Selected URL</Label>
                  <Input readOnly />
                </TextField>
              </div>

              {/* Closed Message */}
              {!registrationOpen && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">
                    Closed Registration Message
                  </h3>
                  <p className="text-sm text-muted">
                    This message will be displayed to members when registration
                    is closed
                  </p>
                  <TextField isInvalid={!!errors.closedMessage}>
                    <TextArea
                      placeholder="Registration for the current year is closed. Please check back next year."
                      value={closedMessage}
                      onChange={(e) => {
                        setClosedMessage(e.target.value);
                        if (errors.closedMessage) {
                          setErrors((prev) => ({
                            ...prev,
                            closedMessage: "",
                          }));
                        }
                      }}
                      rows={3}
                    />
                    <FieldError>{errors.closedMessage}</FieldError>
                  </TextField>
                </div>
              )}

              {/* Last Updated Info */}
              {settings?.updatedAt && (
                <div className="pt-4 border-t border-divider">
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
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-divider sticky bottom-0 bg-surface">
            <Button
              variant="tertiary"
              onPress={handleCancel}
              isDisabled={saving}
            >
              Cancel
            </Button>
            <Button onPress={handleSave} isDisabled={!hasChanges || saving}>
              {!saving && <Icon icon="lucide:save" width={18} height={18} />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
