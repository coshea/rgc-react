import { useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { HANDICAP_FEE, MEMBERSHIP_FEE } from "@/config/membership-pricing";
import { siteConfig } from "@/config/site";
import { subscribeMembershipSettings } from "@/api/membership";
import { addToast } from "@/providers/toast";
import MembershipAdminModal from "@/components/membership-admin-modal";
import MembershipPaymentsFlow from "@/components/membership/membership-payments-flow";
import { useAdminFlag } from "@/components/membership/hooks";
import { useAuth } from "@/providers/AuthProvider";
import type { MembershipSettings } from "@/types/membershipSettings";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function MembershipPage() {
  usePageTracking("Membership");
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);
  const navigate = useNavigate();

  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeMembershipSettings(
      (newSettings) => {
        setSettings(newSettings);
        setLoadingSettings(false);
      },
      (error) => {
        console.error("Failed to subscribe to membership settings:", error);
        addToast({
          title: "Settings unavailable",
          description:
            "Unable to load membership settings. You may be offline or there was a network error.",
          color: "warning",
        });
        setSettings(null);
        setLoadingSettings(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const membershipAmountDue = settings?.fullMembershipPrice ?? MEMBERSHIP_FEE;
  const handicapFee = settings?.handicapMembershipPrice ?? HANDICAP_FEE;
  const membershipLetterUrl =
    settings?.membershipLetterUrl ??
    DEFAULT_MEMBERSHIP_SETTINGS.membershipLetterUrl;
  const membershipApplicationUrl =
    settings?.membershipApplicationUrl ??
    DEFAULT_MEMBERSHIP_SETTINGS.membershipApplicationUrl;

  const showClosedMessage =
    !loadingSettings && settings && !settings.registrationOpen;
  const showFlow = !loadingSettings && (settings?.registrationOpen || isAdmin);

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-4">
      <header className="w-full max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Membership & Annual Dues
        </h1>
        <p className="mt-2 text-muted text-base">
          Please select the option that best applies to you.
        </p>

        {isAdmin ? (
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => setShowAdminModal(true)}
            >
              <Icon icon="lucide:settings" width={16} height={16} />
              Settings
            </Button>

            <Button
              variant="tertiary"
              size="sm"
              onPress={() =>
                navigate(
                  `${siteConfig.pages.membershipDashboard.link}?tab=payments`,
                )
              }
            >
              <Icon
                icon={siteConfig.pages.membershipDashboard.icon}
                width={16}
                height={16}
              />
              Membership Dashboard
            </Button>
          </div>
        ) : null}
      </header>

      <section className="mt-8 w-full max-w-3xl">
        <Card className="border border-content3 bg-surface">
          <Card.Content className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Icon
                icon="lucide:mail-open"
                width={24}
                height={24}
                className="text-accent mt-1 shrink-0"
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Welcome! Read Our Membership Letter
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Before you join or renew, please take a moment to review our
                  annual membership letter from the Board of Governors. It
                  includes important details about tournament schedules, club
                  rules, membership benefits, dues information, and everything
                  you need to know for the upcoming season.
                </p>
              </div>
            </div>
            <Button
              variant="tertiary"
              className="shrink-0 sm:mt-1"
              onPress={() => {
                if (membershipLetterUrl)
                  window.open(
                    membershipLetterUrl,
                    "_blank",
                    "noopener,noreferrer",
                  );
              }}
            >
              <Icon icon="lucide:file-text" width={16} height={16} />
              Read Letter
            </Button>
          </Card.Content>
        </Card>
      </section>

      <MembershipAdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />

      {showClosedMessage ? (
        <div className="mt-10 w-full">
          <Card className="mx-auto w-full max-w-3xl border-2 border-warning bg-surface/70 backdrop-blur">
            <Card.Content className="p-6">
              <div className="flex items-start gap-4">
                <Icon
                  icon="lucide:info"
                  width={24}
                  height={24}
                  className="text-warning mt-1 shrink-0"
                />
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Registration Closed
                  </h3>
                  <p className="text-muted whitespace-pre-line">
                    {settings.closedMessage ??
                      DEFAULT_MEMBERSHIP_SETTINGS.closedMessage}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>
      ) : null}

      {showFlow ? (
        <MembershipPaymentsFlow
          membershipAmountDue={membershipAmountDue}
          handicapFee={handicapFee}
          membershipApplicationUrl={membershipApplicationUrl}
          loginFromPath={siteConfig.pages.membership.link}
        />
      ) : null}
    </div>
  );
}
