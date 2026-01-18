import { useState, useEffect } from "react";
import { Button, Input, Switch, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  updateMembershipSettings,
  subscribeMembershipSettings,
} from "@/api/membership";
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
      }
    );

    return unsubscribe;
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
      closedMessage !== (settings.closedMessage || ""));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleCancel}
    >
      <div
        className="bg-content1 rounded-large shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-divider sticky top-0 bg-content1 z-10">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Icon
              icon="lucide:settings"
              width={24}
              height={24}
              className="text-primary"
            />
            Membership Registration Settings
          </h2>
          <Button
            isIconOnly
            variant="flat"
            onPress={handleCancel}
            aria-label="Close modal"
          >
            <Icon icon="lucide:x" width={20} height={20} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-foreground-500 justify-center py-8">
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
              <div className="flex items-center justify-between p-4 bg-default-100 rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Registration Status</h3>
                  <p className="text-sm text-foreground-500 mt-1">
                    {registrationOpen
                      ? "Members can register or renew their membership"
                      : "Registration is closed - members will see a message"}
                  </p>
                </div>
                <Switch
                  isSelected={registrationOpen}
                  onValueChange={setRegistrationOpen}
                  size="lg"
                  aria-label="Toggle registration status"
                >
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
                </Switch>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Membership Pricing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Membership Price"
                    placeholder="100"
                    value={fullPrice}
                    onChange={(e) => {
                      setFullPrice(e.target.value);
                      if (errors.fullPrice) {
                        setErrors((prev) => ({ ...prev, fullPrice: "" }));
                      }
                    }}
                    startContent={
                      <span className="text-foreground-500">$</span>
                    }
                    type="number"
                    step="0.01"
                    min="0"
                    isInvalid={!!errors.fullPrice}
                    errorMessage={errors.fullPrice}
                  />
                  <Input
                    label="Handicap Index Price"
                    placeholder="50"
                    value={socialPrice}
                    onChange={(e) => {
                      setSocialPrice(e.target.value);
                      if (errors.socialPrice) {
                        setErrors((prev) => ({ ...prev, socialPrice: "" }));
                      }
                    }}
                    startContent={
                      <span className="text-foreground-500">$</span>
                    }
                    type="number"
                    step="0.01"
                    min="0"
                    isInvalid={!!errors.socialPrice}
                    errorMessage={errors.socialPrice}
                  />
                </div>
              </div>

              {/* Closed Message */}
              {!registrationOpen && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">
                    Closed Registration Message
                  </h3>
                  <p className="text-sm text-foreground-500">
                    This message will be displayed to members when registration
                    is closed
                  </p>
                  <Textarea
                    placeholder="Registration for the current year is closed. Please check back next year."
                    value={closedMessage}
                    onChange={(e) => {
                      setClosedMessage(e.target.value);
                      if (errors.closedMessage) {
                        setErrors((prev) => ({ ...prev, closedMessage: "" }));
                      }
                    }}
                    minRows={3}
                    isInvalid={!!errors.closedMessage}
                    errorMessage={errors.closedMessage}
                  />
                </div>
              )}

              {/* Last Updated Info */}
              {settings?.updatedAt && (
                <div className="pt-4 border-t border-divider">
                  <p className="text-sm text-foreground-500">
                    Last updated:{" "}
                    {new Date(
                      typeof settings.updatedAt === "object" &&
                      "toDate" in settings.updatedAt
                        ? settings.updatedAt.toDate()
                        : settings.updatedAt
                    ).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-divider sticky bottom-0 bg-content1">
            <Button variant="flat" onPress={handleCancel} isDisabled={saving}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSave}
              isDisabled={!hasChanges || saving}
              isLoading={saving}
              startContent={
                !saving && <Icon icon="lucide:save" width={18} height={18} />
              }
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
