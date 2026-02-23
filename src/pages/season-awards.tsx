import { Card, CardBody, CardHeader } from "@heroui/react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { SeasonAwardsManager } from "@/components/season-awards-manager";
import BackButton from "@/components/back-button";

export default function SeasonAwardsPage() {
  usePageTracking("Season Awards");

  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <BackButton />
        <div className="w-10" />
      </div>
      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <h1 className="text-xl font-medium">Season Awards</h1>
          <p className="text-sm text-foreground-500">
            Manage season awards by award year.
          </p>
        </CardHeader>
        <CardBody>
          <SeasonAwardsManager />
        </CardBody>
      </Card>
    </div>
  );
}
