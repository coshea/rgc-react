import { Alert, Button } from "@heroui/react";

export function AlreadyPaidNotice(props: {
  currentYear: number;
  onDonationPress: () => void;
}) {
  const { currentYear, onDonationPress } = props;

  return (
    <div className="w-full max-w-4xl">
      <Alert >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Your annual dues are already recorded for {currentYear}. Thank you!
          </div>
          <Button
            size="sm"
            
            variant="tertiary"
            onPress={onDonationPress}
          >
            Make a donation
          </Button>
        </div>
      </Alert>
      <div className="h-4" />
    </div>
  );
}
