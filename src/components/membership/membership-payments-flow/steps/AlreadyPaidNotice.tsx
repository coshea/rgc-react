import { Alert, Button, Spacer } from "@heroui/react";

export function AlreadyPaidNotice(props: {
  currentYear: number;
  onDonationPress: () => void;
}) {
  const { currentYear, onDonationPress } = props;

  return (
    <div className="w-full max-w-4xl">
      <Alert color="success">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Your annual dues are already recorded for {currentYear}. Thank you!
          </div>
          <Button
            size="sm"
            color="primary"
            variant="flat"
            onPress={onDonationPress}
          >
            Make a donation
          </Button>
        </div>
      </Alert>
      <Spacer y={4} />
    </div>
  );
}
