import { useMemo, useState } from "react";
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { useMembers } from "@/hooks/useMembers";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { toDate } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";

// ─── Main component ────────────────────────────────────────────────────────────

export function MemberOverviewTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { allMembers, loading: loadingMembers, activeSet } = useMembers(year);
  const { data: payments, isLoading: loadingPayments } =
    useMembershipPayments(year);

  const isLoading = loadingMembers || loadingPayments;

  // ── derived stats ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const paidThisYear = new Set(
      (payments ?? [])
        .filter((p) => p.status === "confirmed" && p.year === year)
        .map((p) => p.userId),
    );

    const newThisYear = allMembers.filter((m) => {
      const created = toDate(m.createdAt);
      return created && created.getFullYear() === year;
    });

    const notPaidThisYear = allMembers.filter((m) => !paidThisYear.has(m.id));

    const withEmail = allMembers.filter(
      (m) => typeof m.email === "string" && m.email.trim() !== "",
    );

    const paidByCheck = (payments ?? []).filter(
      (p) =>
        p.status === "confirmed" && p.year === year && p.method === "check",
    );
    const paidByCheckUserIds = new Set(paidByCheck.map((p) => p.userId));

    const fullMembers = allMembers.filter(
      (m) => m.membershipType === MEMBERSHIP_TYPES.FULL,
    );
    const handicapOnly = allMembers.filter(
      (m) => m.membershipType === MEMBERSHIP_TYPES.HANDICAP,
    );

    return {
      total: allMembers.length,
      activeCount: activeSet.size,
      newThisYear: newThisYear.length,
      notPaidThisYear: notPaidThisYear.length,
      withEmail: withEmail.length,
      paidByMail: paidByCheckUserIds.size,
      fullMembers: fullMembers.length,
      handicapOnly: handicapOnly.length,
    };
  }, [allMembers, payments, activeSet, year]);

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-default-500">
          Showing data for{" "}
          <span className="font-semibold text-foreground">{year}</span>.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={() => setYear((y) => Math.max(y - 1, 2024))}
            isDisabled={year <= 2024}
            aria-label="Previous year"
          >
            <Icon icon="lucide:chevron-left" className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium w-12 text-center">{year}</span>
          <Button
            size="sm"
            variant="flat"
            isIconOnly
            onPress={() => setYear((y) => Math.min(y + 1, currentYear))}
            isDisabled={year >= currentYear}
            aria-label="Next year"
          >
            <Icon icon="lucide:chevron-right" className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card shadow="sm">
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-default-500">Total Members</p>
                    <p className="mt-1 text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon
                      icon="lucide:users"
                      className="w-5 h-5 text-primary"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-default-400">
                  {stats.activeCount} active (paid last 2 yrs)
                </p>
              </CardBody>
            </Card>

            <Card shadow="sm">
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-default-500">New This Year</p>
                    <p className="mt-1 text-2xl font-bold">
                      {stats.newThisYear}
                    </p>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    <Icon
                      icon="lucide:user-plus"
                      className="w-5 h-5 text-success"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-default-400">
                  Joined in {year}
                </p>
              </CardBody>
            </Card>

            <Card shadow="sm">
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-default-500">Not Paid Yet</p>
                    <p className="mt-1 text-2xl font-bold">
                      {stats.notPaidThisYear}
                    </p>
                  </div>
                  <div className="rounded-lg bg-warning/10 p-2">
                    <Icon
                      icon="lucide:clock"
                      className="w-5 h-5 text-warning"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-default-400">
                  No confirmed payment in {year}
                </p>
              </CardBody>
            </Card>

            <Card shadow="sm">
              <CardBody className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-default-500">Paid by Check</p>
                    <p className="mt-1 text-2xl font-bold">
                      {stats.paidByMail}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/10 p-2">
                    <Icon
                      icon="lucide:mail"
                      className="w-5 h-5 text-secondary"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-default-400">
                  Confirmed check payments in {year}
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Secondary stats row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card shadow="sm">
              <CardBody className="p-5">
                <p className="text-sm text-default-500">Full Membership</p>
                <p className="mt-1 text-xl font-bold">{stats.fullMembers}</p>
                <p className="mt-1 text-xs text-default-400">
                  Members with full access
                </p>
              </CardBody>
            </Card>
            <Card shadow="sm">
              <CardBody className="p-5">
                <p className="text-sm text-default-500">Handicap Only</p>
                <p className="mt-1 text-xl font-bold">{stats.handicapOnly}</p>
                <p className="mt-1 text-xs text-default-400">
                  Handicap-only members
                </p>
              </CardBody>
            </Card>
            <Card shadow="sm">
              <CardBody className="p-5">
                <p className="text-sm text-default-500">With Email</p>
                <p className="mt-1 text-xl font-bold">{stats.withEmail}</p>
                <p className="mt-1 text-xs text-default-400">
                  Can receive email notifications
                </p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
