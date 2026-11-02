import { useMemo, useState } from "react";
import { Button, Chip, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";

import { useMembers } from "@/hooks/useMembers";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { toDate } from "@/api/users";
import type { User } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";
import { siteConfig } from "@/config/site";
import { copyOrMailtoEmails } from "@/utils/email";
import { OverviewKpi } from "@/components/admin-dashboard/overview-kpi";
import { PaymentMethodSplit } from "@/components/admin-dashboard/payment-method-split";

// ─── Main component ────────────────────────────────────────────────────────────

export function MemberOverviewTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showNotPaid, setShowNotPaid] = useState(false);
  const navigate = useNavigate();

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

    const notPaidThisYearList: User[] = allMembers
      .filter((m) => !paidThisYear.has(m.id))
      .sort((a, b) => {
        const aName = (
          a.displayName ||
          `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() ||
          a.email ||
          ""
        ).toLowerCase();
        const bName = (
          b.displayName ||
          `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim() ||
          b.email ||
          ""
        ).toLowerCase();
        return aName.localeCompare(bName);
      });

    const paidByCheck = (payments ?? []).filter(
      (p) =>
        p.status === "confirmed" && p.year === year && p.method === "check",
    );
    const paidByCheckUserIds = new Set(paidByCheck.map((p) => p.userId));

    const paidByPayPal = (payments ?? []).filter(
      (p) =>
        p.status === "confirmed" && p.year === year && p.method === "paypal",
    );
    const paidByPayPalUserIds = new Set(paidByPayPal.map((p) => p.userId));

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
      notPaidThisYearList,
      notPaidThisYear: notPaidThisYearList.length,
      paidByMail: paidByCheckUserIds.size,
      paidByPayPal: paidByPayPalUserIds.size,
      fullMembers: fullMembers.length,
      handicapOnly: handicapOnly.length,
    };
  }, [allMembers, payments, activeSet, year]);

  const paidCount = stats.paidByMail + stats.paidByPayPal;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Showing data for{" "}
          <span className="font-semibold text-foreground">{year}</span>.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="tertiary"
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
            variant="tertiary"
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
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <OverviewKpi
              title="Total Members"
              value={stats.total}
              icon="lucide:users"
              iconClassName="bg-accent/10 text-accent"
            >
              {stats.activeCount} active (paid last 2 yrs)
            </OverviewKpi>

            <OverviewKpi
              title="Memberships"
              value={stats.fullMembers + stats.handicapOnly}
              icon="lucide:id-card"
              iconClassName="bg-secondary/10 text-secondary"
            >
              Full:{" "}
              <span className="font-medium text-foreground">
                {stats.fullMembers}
              </span>{" "}
              · Handicap:{" "}
              <span className="font-medium text-foreground">
                {stats.handicapOnly}
              </span>
            </OverviewKpi>

            <OverviewKpi
              title="New This Year"
              value={stats.newThisYear}
              icon="lucide:user-plus"
              status="success"
            >
              Joined in {year}
            </OverviewKpi>
          </dl>

          <dl className="grid gap-4 sm:grid-cols-2">
            <OverviewKpi
              title="Not Paid Yet"
              value={stats.notPaidThisYear}
              icon="lucide:clock"
              status="warning"
              action={{
                label: `Not paid yet: ${stats.notPaidThisYear}. View members`,
                onPress: () => setShowNotPaid(true),
              }}
            >
              No payment in {year} · click to view
            </OverviewKpi>

            <OverviewKpi
              title="Payments"
              value={paidCount}
              icon="lucide:credit-card"
              iconClassName="bg-accent/10 text-accent"
            >
              <PaymentMethodSplit
                check={stats.paidByMail}
                paypal={stats.paidByPayPal}
              />
            </OverviewKpi>
          </dl>

          {/* Not Paid Yet modal */}
          {showNotPaid && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowNotPaid(false)}
              />
              <div className="relative bg-background dark:bg-default/60 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col z-10">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <div>
                    <h3 className="font-semibold text-base">
                      Not Paid Yet — {year}
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      {stats.notPaidThisYear} member
                      {stats.notPaidThisYear !== 1 ? "s" : ""} with no confirmed
                      payment
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="Close"
                    onPress={() => setShowNotPaid(false)}
                  >
                    <Icon icon="lucide:x" className="w-4 h-4" />
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 px-5 py-3 border-b">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      const emails = stats.notPaidThisYearList.map(
                        (m) => m.email ?? "",
                      );
                      void copyOrMailtoEmails(emails);
                    }}
                  >
                    <Icon icon="lucide:mail" className="w-4 h-4" />
                    Email all
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      setShowNotPaid(false);
                      navigate(
                        `${siteConfig.pages.adminDashboard.link}?tab=payments`,
                      );
                    }}
                  >
                    <Icon icon="lucide:check-square" className="w-4 h-4" />
                    Go to bulk check payments
                  </Button>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1">
                  {stats.notPaidThisYearList.length === 0 ? (
                    <p className="px-5 py-8 text-center text-muted text-sm">
                      Everyone has paid — great!
                    </p>
                  ) : (
                    <ul className="divide-y divide-default-200">
                      {stats.notPaidThisYearList.map((m) => {
                        const name =
                          m.displayName ||
                          [m.firstName, m.lastName].filter(Boolean).join(" ") ||
                          m.email ||
                          m.id;
                        return (
                          <li
                            key={m.id}
                            className="flex items-center justify-between px-5 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {name}
                              </p>
                              <p className="text-xs text-muted truncate">
                                {m.email || "—"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-3 shrink-0">
                              {m.membershipType && (
                                <Chip
                                  size="sm"
                                  variant="tertiary"
                                  color={
                                    m.membershipType === MEMBERSHIP_TYPES.FULL
                                      ? "success"
                                      : m.membershipType ===
                                          MEMBERSHIP_TYPES.HANDICAP
                                        ? "accent"
                                        : "default"
                                  }
                                >
                                  {m.membershipType === MEMBERSHIP_TYPES.FULL
                                    ? "Full"
                                    : "Handicap"}
                                </Chip>
                              )}
                              {m.email && (
                                <a
                                  href={`mailto:${m.email}`}
                                  className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-default/60 transition-colors"
                                  aria-label={`Email ${name}`}
                                >
                                  <Icon
                                    icon="lucide:mail"
                                    className="w-4 h-4"
                                  />
                                </a>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
