import { Card, CardBody, CardHeader, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { MembershipOption } from "../types";

export function SelectOptionStep(props: {
  membershipOptionsDisabled: boolean;
  currentYear: number;
  onSelectOption: (option: MembershipOption) => void;
}) {
  const { membershipOptionsDisabled, currentYear, onSelectOption } = props;

  const disabledClass = "border border-default-200 opacity-60";
  const enabledClass = "border border-default-200 hover:bg-content2";

  return (
    <Card className="w-full max-w-4xl" shadow="sm">
      <CardHeader className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Step 1: Select option</h2>
        <p className="text-sm text-default-600">Membership & Payments</p>
      </CardHeader>
      <Divider />
      <CardBody>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card
            isPressable={!membershipOptionsDisabled}
            onPress={() => onSelectOption("renew")}
            role="button"
            aria-label="Renew Membership"
            className={membershipOptionsDisabled ? disabledClass : enabledClass}
          >
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:refresh-ccw" width={18} height={18} />
                <h3 className="font-semibold">Renew Membership</h3>
              </div>
              <p className="text-sm text-default-600">
                {membershipOptionsDisabled
                  ? `Annual dues already paid for ${currentYear}`
                  : "For current members paying annual dues"}
              </p>
            </CardBody>
          </Card>

          <Card
            isPressable={!membershipOptionsDisabled}
            onPress={() => onSelectOption("new")}
            role="button"
            aria-label="New Member Application"
            className={membershipOptionsDisabled ? disabledClass : enabledClass}
          >
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:user-plus" width={18} height={18} />
                <h3 className="font-semibold">New Member Application</h3>
              </div>
              <p className="text-sm text-default-600">
                {membershipOptionsDisabled
                  ? "Unavailable after payment"
                  : "Apply to join the club"}
              </p>
            </CardBody>
          </Card>

          <Card
            isPressable={!membershipOptionsDisabled}
            onPress={() => onSelectOption("handicap")}
            role="button"
            aria-label="Handicap Index Only"
            className={membershipOptionsDisabled ? disabledClass : enabledClass}
          >
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:golf" width={18} height={18} />
                <h3 className="font-semibold">Handicap Index Only</h3>
              </div>
              <p className="text-sm text-default-600">
                {membershipOptionsDisabled
                  ? "Unavailable after payment"
                  : "GHIN handicap without club membership"}
              </p>
            </CardBody>
          </Card>

          <Card
            isPressable
            onPress={() => onSelectOption("donation")}
            role="button"
            aria-label="Make a Donation"
            className={enabledClass}
          >
            <CardBody className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon icon="lucide:hand-heart" width={18} height={18} />
                <h3 className="font-semibold">Make a Donation</h3>
              </div>
              <p className="text-sm text-default-600">Support the club</p>
            </CardBody>
          </Card>
        </div>
      </CardBody>
    </Card>
  );
}
