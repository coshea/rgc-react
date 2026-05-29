import { Alert, Button } from "@heroui/react";

export function AlreadyPaidNotice(props: {
  currentYear: number;
  onDonationPress: () => void;
}) {
  const { currentYear, onDonationPress } = props;

  return (
    <div className="w-full max-w-4xl">
      <Alert status="success">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title className="text-base font-semibold">
            Your annual dues are already recorded for {currentYear}. Thank you!
          </Alert.Title>
        </Alert.Content>
        <Button size="sm" variant="tertiary" onPress={onDonationPress}>
          Make a donation
        </Button>
      </Alert>
      <div className="h-4" />
    </div>
  );
}
