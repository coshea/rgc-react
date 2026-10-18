import { Card } from "@heroui/react";
import { Icon } from "@iconify/react";

import { MembershipSettingsForm } from "@/components/membership/membership-settings-form";

/** Admin dashboard view of the membership page's Settings modal. */
export function MembershipSettingsTab() {
  return (
    <div className="mx-auto w-full max-w-3xl pt-4">
      <div className="mb-4 flex items-start gap-2">
        <Icon
          icon="lucide:settings"
          width={22}
          height={22}
          className="mt-0.5 shrink-0 text-accent"
        />
        <div>
          <h2 className="text-xl font-semibold">Membership Settings</h2>
          <p className="text-sm text-muted">
            Registration status, automated emails, pricing and documents.
          </p>
        </div>
      </div>
      <Card className="border border-content3 bg-surface">
        <Card.Content className="p-0 sm:p-2">
          <MembershipSettingsForm layout="page" />
        </Card.Content>
      </Card>
    </div>
  );
}
