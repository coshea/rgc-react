import { useEffect, useState } from "react";
import { Button, Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { HANDICAP_FEE, MEMBERSHIP_FEE } from "@/config/membership-pricing";
import { siteConfig } from "@/config/site";
import { subscribeMembershipSettings } from "@/api/membership";
import MembershipAdminModal from "@/components/membership-admin-modal";
import MembershipPaymentsFlow from "@/components/membership/membership-payments-flow";
import { useDocAdminFlag } from "@/components/membership/hooks";
import { useAuth } from "@/providers/AuthProvider";
import type { MembershipSettings } from "@/types/membershipSettings";
import { DEFAULT_MEMBERSHIP_SETTINGS } from "@/types/membershipSettings";

export default function MembershipPage() {
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  const [settings, setSettings] = useState<MembershipSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeMembershipSettings((newSettings) => {
      setSettings(newSettings);
      setLoadingSettings(false);
    });
    return () => unsubscribe();
  }, []);

  const membershipAmountDue = settings?.fullMembershipPrice ?? MEMBERSHIP_FEE;
  const handicapFee = settings?.handicapMembershipPrice ?? HANDICAP_FEE;

  const showClosedMessage =
    !loadingSettings && settings && !settings.registrationOpen;
  const showFlow = !loadingSettings && (settings?.registrationOpen || isAdmin);

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16">
      <header className="w-full max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          Membership & Annual Dues
        </h1>
        <p className="mt-2 text-default-500 text-base">
          Please select the option that best applies to you.
        </p>

        {isAdmin ? (
          <div className="mt-6 flex justify-center">
            <Button
              color="primary"
              variant="flat"
              size="sm"
              onPress={() => setShowAdminModal(true)}
              startContent={
                <Icon icon="lucide:settings" width={16} height={16} />
              }
            >
              Settings
            </Button>
          </div>
        ) : null}
      </header>

      <MembershipAdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />

      {showClosedMessage ? (
        <div className="mt-10 w-full">
          <Card className="mx-auto w-full max-w-3xl border-2 border-warning bg-content1/70 backdrop-blur">
            <CardBody className="p-6">
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
                  <p className="text-foreground-600 whitespace-pre-line">
                    {settings.closedMessage ??
                      DEFAULT_MEMBERSHIP_SETTINGS.closedMessage}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {showFlow ? (
        <MembershipPaymentsFlow
          membershipAmountDue={membershipAmountDue}
          handicapFee={handicapFee}
          loginFromPath={siteConfig.pages.membership.link}
        />
      ) : null}
    </div>
  );
}
