import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  Button,
  ButtonGroup,
  Card,
  Chip,
  Input,
  ListBox,
  Select,
  Spinner,
  SearchField,
  cn,
} from "@heroui/react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import BackButton from "@/components/back-button";
import { addToast } from "@/providers/toast";
import { useAuth } from "@/providers/AuthProvider";

import { usePageTracking } from "@/hooks/usePageTracking";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  confirmMembershipPaymentGroup,
  getMembershipSettings,
  reconcilePayPalMembershipOrders,
  updateMembershipPayment,
} from "@/api/membership";
import UserSelect from "@/components/UserSelect";
import {
  MEMBERSHIP_TYPES,
  type MembershipType,
  type ReconcilePayPalOrdersResponse,
} from "@@/types";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { useMembers } from "@/hooks/useMembers";
import { HANDICAP_FEE, MEMBERSHIP_FEE } from "@/config/membership-pricing";
import { useAdminFlag } from "@/components/membership/hooks";

type Filter = "all" | "yearly" | "handicap" | "donation";

function typeLabel(type?: MembershipType | string | null) {
  switch (type) {
    case MEMBERSHIP_TYPES.FULL:
      return "Full Membership";
    case MEMBERSHIP_TYPES.HANDICAP:
      return "Handicap Only";
    default:
      return type ?? "—";
  }
}

function methodLabel(method?: string | null) {
  switch (method) {
    case "paypal":
      return "PayPal";
    case "check":
      return "Check";
    default:
      return method ?? "—";
  }
}

function typeColor(
  type?: MembershipType | string | null,
): "success" | "accent" | "default" {
  switch (type) {
    case MEMBERSHIP_TYPES.FULL:
      return "success";
    case MEMBERSHIP_TYPES.HANDICAP:
      return "accent";
    default:
      return "default";
  }
}

function currency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function toMillis(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value !== null) {
    const candidate = value as { toMillis?: () => number };
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
  }
  return 0;
}

function formatDate(value: unknown) {
  const ms = toMillis(value);
  if (!ms) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
}

function paymentPurpose(purpose?: string | null) {
  return purpose === "donation" ? "donation" : "dues";
}

export function PaymentsTab({ isEmbedded = false }: { isEmbedded?: boolean }) {
  usePageTracking("Payments Tab");

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [confirmingGroupId, setConfirmingGroupId] = useState<string | null>(
    null,
  );
  const [_reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] =
    useState<ReconcilePayPalOrdersResponse | null>(null);

  // Bulk check payment state
  const [bulkQueue, setBulkQueue] = useState<
    Array<{ userId: string; membershipType: MembershipType }>
  >([]);
  const [bulkSelectedUserId, setBulkSelectedUserId] = useState("");
  const [bulkMembershipType, setBulkMembershipType] = useState<MembershipType>(
    MEMBERSHIP_TYPES.FULL,
  );
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);
  const qc = useQueryClient();

  const isMobileView = useMediaQuery("(max-width: 639px)");

  const { allMembers, loading: loadingMembers } = useMembers(year);
  const { data: payments, isLoading: loadingPayments } =
    useMembershipPayments(year);

  const { data: settings } = useQuery({
    queryKey: ["membershipSettings"],
    queryFn: getMembershipSettings,
    staleTime: 60_000,
  });

  const fullFee = settings?.fullMembershipPrice ?? MEMBERSHIP_FEE;
  const handicapFee = settings?.handicapMembershipPrice ?? HANDICAP_FEE;

  const userById = useMemo(() => {
    const map = new Map<string, (typeof allMembers)[number]>();
    for (const u of allMembers) map.set(u.id, u);
    return map;
  }, [allMembers]);

  const rows = useMemo(() => {
    const confirmedDues = (payments || []).filter(
      (p) => p.status === "confirmed" && paymentPurpose(p.purpose) === "dues",
    );

    const confirmedDonations = (payments || []).filter(
      (p) =>
        p.status === "confirmed" && paymentPurpose(p.purpose) === "donation",
    );

    const donationByGroupId = new Map<string, number>();
    for (const donation of confirmedDonations) {
      if (!donation.groupId) continue;
      donationByGroupId.set(
        donation.groupId,
        (donationByGroupId.get(donation.groupId) ?? 0) + (donation.amount ?? 0),
      );
    }

    const duesGroupIds = new Set<string>();
    confirmedDues.forEach((payment) => {
      if (payment.groupId) duesGroupIds.add(payment.groupId);
    });

    const latestByUser = new Map<string, (typeof confirmedDues)[number]>();
    for (const payment of confirmedDues) {
      const existing = latestByUser.get(payment.userId);
      if (!existing) {
        latestByUser.set(payment.userId, payment);
        continue;
      }
      const existingTime =
        toMillis(existing.paidAt) || toMillis(existing.createdAt);
      const nextTime = toMillis(payment.paidAt) || toMillis(payment.createdAt);
      if (nextTime >= existingTime) {
        latestByUser.set(payment.userId, payment);
      }
    }

    const confirmed = Array.from(latestByUser.values());

    const duesRows = confirmed
      .map((p) => {
        const user = userById.get(p.userId);
        const name =
          user?.displayName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
          user?.email ||
          p.userId;

        const baseFee =
          p.membershipType === MEMBERSHIP_TYPES.HANDICAP
            ? handicapFee
            : fullFee;
        const donationAmount = p.groupId
          ? (donationByGroupId.get(p.groupId) ?? 0)
          : p.amount != null && Number.isFinite(p.amount)
            ? Math.max(0, p.amount - baseFee)
            : 0;

        return {
          id: p.id ?? `${p.userId}_${p.year}`,
          userId: p.userId,
          name,
          email: user?.email || "",
          membershipType: p.membershipType,
          method: p.method ?? null,
          paymentAmount: p.amount ?? null,
          donationAmount,
          groupId: p.groupId ?? null,
          paidAt: p.paidAt ?? p.createdAt ?? null,
          rowType: "dues" as const,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const donationOnlyRows = confirmedDonations
      .filter(
        (donation) => !donation.groupId || !duesGroupIds.has(donation.groupId),
      )
      .map((donation) => {
        const user = userById.get(donation.userId);
        const name =
          user?.displayName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
          user?.email ||
          donation.userId;

        return {
          id:
            donation.id ??
            `donation_${donation.userId}_${donation.year}_${donation.groupId ?? ""}`,
          userId: donation.userId,
          name,
          email: user?.email || "",
          membershipType: donation.membershipType,
          method: donation.method ?? null,
          paymentAmount: null,
          donationAmount: donation.amount ?? 0,
          groupId: donation.groupId ?? null,
          paidAt: donation.paidAt ?? donation.createdAt ?? null,
          rowType: "donation" as const,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return { duesRows, donationOnlyRows };
  }, [payments, userById, fullFee, handicapFee]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sourceRows =
      filter === "donation" || filter === "all"
        ? [...rows.duesRows, ...rows.donationOnlyRows]
        : rows.duesRows;

    const filtered = sourceRows.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q);

      const matchesType =
        filter === "all" ||
        (filter === "yearly" && r.membershipType === MEMBERSHIP_TYPES.FULL) ||
        (filter === "handicap" &&
          r.membershipType === MEMBERSHIP_TYPES.HANDICAP) ||
        (filter === "donation" && r.donationAmount > 0);

      return matchesSearch && matchesType;
    });

    return filtered.sort((a, b) => {
      const timeDiff = toMillis(b.paidAt) - toMillis(a.paidAt);
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name);
    });
  }, [rows, filter, search]);

  // Reset to page 1 whenever the filtered result set changes
  const filteredRowsCount = filteredRows.length;
  React.useEffect(() => {
    setPage(1);
  }, [filteredRowsCount]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page, PAGE_SIZE],
  );

  const stats = useMemo(() => {
    const confirmedDonations = (payments || []).filter(
      (p) =>
        p.status === "confirmed" && paymentPurpose(p.purpose) === "donation",
    );
    const confirmedDues = (payments || []).filter(
      (p) => p.status === "confirmed" && paymentPurpose(p.purpose) === "dues",
    );

    const yearlyAmount = confirmedDues.reduce((sum, payment) => {
      if (payment.membershipType !== MEMBERSHIP_TYPES.FULL) return sum;
      return sum + (payment.amount ?? 0);
    }, 0);

    const handicapAmount = confirmedDues.reduce((sum, payment) => {
      if (payment.membershipType !== MEMBERSHIP_TYPES.HANDICAP) return sum;
      return sum + (payment.amount ?? 0);
    }, 0);

    const donationAmount = confirmedDonations.reduce(
      (sum, payment) => sum + (payment.amount ?? 0),
      0,
    );
    const totalAmount = yearlyAmount + handicapAmount + donationAmount;

    // Build weekly chart data (cumulative by week of year)
    const weeksInYear = 53;
    const weeklyTotals = Array.from({ length: weeksInYear }, () => ({
      total: 0,
      yearly: 0,
      handicap: 0,
      donations: 0,
    }));

    function getWeekOfYear(date: Date): number {
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const dayOfYear =
        Math.floor(
          (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
      return Math.min(Math.ceil(dayOfYear / 7), weeksInYear) - 1; // 0-indexed
    }

    for (const p of confirmedDues) {
      const ms = toMillis(p.paidAt ?? p.createdAt);
      if (!ms) continue;
      const d = new Date(ms);
      if (d.getFullYear() !== year) continue;
      const w = getWeekOfYear(d);
      weeklyTotals[w].total += p.amount ?? 0;
      if (p.membershipType === MEMBERSHIP_TYPES.FULL) {
        weeklyTotals[w].yearly += p.amount ?? 0;
      } else if (p.membershipType === MEMBERSHIP_TYPES.HANDICAP) {
        weeklyTotals[w].handicap += p.amount ?? 0;
      }
    }
    for (const p of confirmedDonations) {
      const ms = toMillis(p.paidAt ?? p.createdAt);
      if (!ms) continue;
      const d = new Date(ms);
      if (d.getFullYear() !== year) continue;
      const w = getWeekOfYear(d);
      weeklyTotals[w].donations += p.amount ?? 0;
      weeklyTotals[w].total += p.amount ?? 0;
    }

    // Cap to current week when viewing the current year
    const currentWeek =
      year === new Date().getFullYear()
        ? getWeekOfYear(new Date())
        : weeksInYear - 1;

    // Cumulative
    let cumTotal = 0,
      cumYearly = 0,
      cumHandicap = 0,
      cumDonations = 0;
    const chartData = Array.from({ length: currentWeek + 1 }, (_, i) => {
      cumTotal += weeklyTotals[i].total;
      cumYearly += weeklyTotals[i].yearly;
      cumHandicap += weeklyTotals[i].handicap;
      cumDonations += weeklyTotals[i].donations;
      return {
        week: `W${i + 1}`,
        total: cumTotal,
        yearly: cumYearly,
        handicap: cumHandicap,
        donations: cumDonations,
      };
    });

    return {
      total: rows.duesRows.length,
      yearly: rows.duesRows.filter(
        (r) => r.membershipType === MEMBERSHIP_TYPES.FULL,
      ).length,
      handicap: rows.duesRows.filter(
        (r) => r.membershipType === MEMBERSHIP_TYPES.HANDICAP,
      ).length,
      donations: confirmedDonations.length,
      totalAmount,
      yearlyAmount,
      handicapAmount,
      donationAmount,
      chartData,
    };
  }, [rows, payments, year]);

  const pendingChecks = useMemo(() => {
    const dues = (payments || []).filter(
      (p) => paymentPurpose(p.purpose) === "dues",
    );
    const pendingDonations = (payments || []).filter(
      (p) => p.status === "pending" && paymentPurpose(p.purpose) === "donation",
    );

    const donationByGroupId = new Map<string, number>();
    for (const donation of pendingDonations) {
      if (!donation.groupId) continue;
      donationByGroupId.set(
        donation.groupId,
        (donationByGroupId.get(donation.groupId) ?? 0) + (donation.amount ?? 0),
      );
    }

    const grouped = new Map<
      string,
      {
        id: string;
        groupId?: string | null;
        userId: string;
        membershipType: MembershipType | null;
        amount: number | null;
        donationAmount: number;
        paidAt: unknown;
      }
    >();

    for (const payment of dues) {
      if (payment.status !== "pending" || payment.method !== "check") continue;
      const key = payment.groupId ?? payment.id ?? `${payment.userId}_${year}`;
      grouped.set(key, {
        id: payment.id ?? key,
        groupId: payment.groupId ?? null,
        userId: payment.userId,
        membershipType: payment.membershipType ?? null,
        amount: payment.amount ?? null,
        donationAmount: payment.groupId
          ? (donationByGroupId.get(payment.groupId) ?? 0)
          : 0,
        paidAt: payment.paidAt ?? payment.createdAt ?? null,
      });
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const aUser = userById.get(a.userId);
      const bUser = userById.get(b.userId);
      const aName =
        aUser?.displayName ||
        [aUser?.firstName, aUser?.lastName].filter(Boolean).join(" ") ||
        aUser?.email ||
        a.userId;
      const bName =
        bUser?.displayName ||
        [bUser?.firstName, bUser?.lastName].filter(Boolean).join(" ") ||
        bUser?.email ||
        b.userId;
      return aName.localeCompare(bName);
    });
  }, [payments, userById, year]);

  const alreadyPaidIds = useMemo(
    () => new Set(rows.duesRows.map((r) => r.userId)),
    [rows.duesRows],
  );

  const bulkQueueIds = useMemo(
    () => new Set(bulkQueue.map((q) => q.userId)),
    [bulkQueue],
  );

  const bulkEligibleMembers = useMemo(
    () =>
      allMembers.filter(
        (m) => !alreadyPaidIds.has(m.id) && !bulkQueueIds.has(m.id),
      ),
    [allMembers, alreadyPaidIds, bulkQueueIds],
  );

  async function handleConfirmCheck(
    groupId?: string | null,
    paymentId?: string,
  ) {
    const key = groupId ?? paymentId ?? null;
    if (!key) return;
    setConfirmingGroupId(key);
    try {
      await confirmMembershipPaymentGroup({
        groupId: groupId ?? undefined,
        paymentId: groupId ? undefined : paymentId,
      });
      await qc.invalidateQueries({ queryKey: ["membershipPayments", year] });
      await qc.invalidateQueries({ queryKey: ["activeMembers", year] });
      addToast({
        title: "Payment confirmed",
        description: "The check payment was marked as paid.",
        color: "success",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      addToast({
        title: "Update failed",
        description: message,
        color: "danger",
      });
    } finally {
      setConfirmingGroupId(null);
    }
  }

  async function handleBulkSubmit() {
    if (bulkQueue.length === 0) return;
    setSubmittingBulk(true);
    const failedNames: string[] = [];
    const results = await Promise.allSettled(
      bulkQueue.map((item) => {
        const amount =
          item.membershipType === MEMBERSHIP_TYPES.HANDICAP
            ? handicapFee
            : fullFee;
        return updateMembershipPayment({
          userId: item.userId,
          year,
          updates: {
            method: "check",
            status: "confirmed",
            membershipType: item.membershipType,
            amount,
          },
        });
      }),
    );
    let success = 0;
    let denormWarnings = 0;
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        success++;
        if (result.value?.denormWarning) denormWarnings++;
      } else {
        const member = userById.get(bulkQueue[i].userId);
        const name =
          member?.displayName ||
          [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
          member?.email ||
          bulkQueue[i].userId;
        failedNames.push(name);
      }
    });
    await qc.invalidateQueries({ queryKey: ["membershipPayments", year] });
    await qc.invalidateQueries({ queryKey: ["activeMembers", year] });
    if (failedNames.length === 0) {
      addToast({
        title: "Payments recorded",
        description: `${success} check payment${success === 1 ? "" : "s"} recorded successfully.`,
        color: "success",
      });
      setBulkQueue([]);
    } else {
      addToast({
        title: "Some payments failed",
        description: `${success} succeeded, ${failedNames.length} failed: ${failedNames.join(", ")}`,
        color: "warning",
      });
    }
    if (denormWarnings > 0) {
      addToast({
        title: "Profile sync failed",
        description: `${denormWarnings} member profile${denormWarnings === 1 ? "" : "s"} could not be synced after payment. Please refresh and verify their membership status.`,
        color: "warning",
      });
    }
    setSubmittingBulk(false);
  }

  async function handleReconcilePayPal() {
    if (!user) {
      addToast({
        title: "Sign in required",
        description: "Please sign in to run PayPal reconciliation.",
        color: "danger",
      });
      return;
    }

    setReconciling(true);
    try {
      const result = await reconcilePayPalMembershipOrders({ user });
      setReconcileResult(result);

      await qc.invalidateQueries({ queryKey: ["membershipPayments", year] });
      await qc.invalidateQueries({ queryKey: ["activeMembers", year] });

      const issues =
        (result.errors?.length ?? 0) + (result.skippedItems?.length ?? 0);

      addToast({
        title:
          issues > 0
            ? "Reconciliation complete with notes"
            : "Reconciliation complete",
        description: `Scanned ${result.scanned}, recorded ${result.processed}.`,
        color: issues > 0 ? "warning" : "success",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Reconciliation failed";
      addToast({
        title: "Reconciliation failed",
        description: message,
        color: "danger",
      });
    } finally {
      setReconciling(false);
    }
  }

  const isLoading = loadingMembers || loadingPayments;

  function exportPaymentsCsv() {
    const allRows = [...rows.duesRows, ...rows.donationOnlyRows];
    const headers = [
      "Name",
      "Email",
      "Membership Type",
      "Method",
      "Payment",
      "Donation",
      "Paid",
    ];
    const dataRows = allRows.map((r) => [
      r.name,
      r.email,
      typeLabel(r.membershipType),
      methodLabel(r.method),
      r.paymentAmount != null ? String(r.paymentAmount) : "",
      r.donationAmount > 0 ? String(r.donationAmount) : "",
      formatDate(r.paidAt),
    ]);
    const csv = [headers, ...dataRows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rgc-payments-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={isEmbedded ? "" : "min-h-screen px-4 py-12 sm:px-6"}>
      <div className={isEmbedded ? "" : "mx-auto max-w-6xl"}>
        {!isEmbedded && (
          <>
            <div className="mb-4">
              <BackButton />
            </div>
            <h1 className="text-3xl font-bold">Membership Dashboard</h1>
            <p className="mt-2 text-muted">
              Payments recorded for {year}. Donations are tracked as separate
              transactions.
            </p>
          </>
        )}

        <dl className="mt-8 grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
          {[
            {
              title: "Payments",
              subtitle: "All confirmed payments",
              value: stats.total,
              amount: currency(stats.totalAmount),
              chartData: stats.chartData.map((d) => ({
                week: d.week,
                value: d.total,
              })),
              color: "primary" as const,
              icon: "solar:wallet-bold",
            },
            {
              title: "Full Membership",
              subtitle: "Yearly dues collected",
              value: stats.yearly,
              amount: currency(stats.yearlyAmount),
              chartData: stats.chartData.map((d) => ({
                week: d.week,
                value: d.yearly,
              })),
              color: "success" as const,
              icon: "solar:user-check-bold",
            },
            {
              title: "Handicap Only",
              subtitle: "Handicap dues collected",
              value: stats.handicap,
              amount: currency(stats.handicapAmount),
              chartData: stats.chartData.map((d) => ({
                week: d.week,
                value: d.handicap,
              })),
              color: "warning" as const,
              icon: "solar:golf-bold",
            },
            {
              title: "Donations",
              subtitle: "Confirmed donations",
              value: stats.donations,
              amount: currency(stats.donationAmount),
              chartData: stats.chartData.map((d) => ({
                week: d.week,
                value: d.donations,
              })),
              color: "secondary" as const,
              icon: "solar:heart-bold",
            },
          ].map(
            (
              { title, subtitle, value, amount, chartData, color, icon },
              index,
            ) => (
              <Card
                key={index}
                className="dark:relative border border-transparent"
              >
                <section className="flex flex-col flex-nowrap">
                  <div className="flex flex-col justify-between gap-y-2 px-4 pt-4">
                    <div className="flex flex-col gap-y-2">
                      <div className="flex items-center gap-x-2">
                        <Icon
                          icon={icon}
                          className={cn({
                            "text-accent": color === "primary",
                            "text-success": color === "success",
                            "text-warning": color === "warning",
                            "text-secondary": color === "secondary",
                          })}
                          width={18}
                          height={18}
                        />
                        <div className="flex flex-col gap-y-0">
                          <dt className="text-foreground text-sm font-medium">
                            {title}
                          </dt>
                          <dd className="text-xs text-muted font-normal">
                            {subtitle}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-x-2">
                        <dd className="text-foreground text-xl font-semibold">
                          {value}
                        </dd>
                        <span className="text-sm text-muted">{amount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-24 w-full">
                    <ResponsiveContainer
                      width="100%"
                      height={96}
                      minWidth={0}
                      className="[&_.recharts-surface]:outline-hidden"
                    >
                      <AreaChart
                        accessibilityLayer
                        className="translate-y-1 scale-105"
                        data={chartData}
                      >
                        <defs>
                          <linearGradient
                            id={`kpiGradient${index}`}
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                          >
                            <stop
                              offset="10%"
                              stopColor={cn({
                                "hsl(var(--heroui-primary))":
                                  color === "primary",
                                "hsl(var(--heroui-success))":
                                  color === "success",
                                "hsl(var(--heroui-warning))":
                                  color === "warning",
                                "hsl(var(--heroui-secondary))":
                                  color === "secondary",
                              })}
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="100%"
                              stopColor={cn({
                                "hsl(var(--heroui-primary))":
                                  color === "primary",
                                "hsl(var(--heroui-success))":
                                  color === "success",
                                "hsl(var(--heroui-warning))":
                                  color === "warning",
                                "hsl(var(--heroui-secondary))":
                                  color === "secondary",
                              })}
                              stopOpacity={0.1}
                            />
                          </linearGradient>
                        </defs>
                        <YAxis
                          domain={[
                            Math.min(...chartData.map((d) => d.value)),
                            "auto",
                          ]}
                          hide={true}
                        />
                        <Area
                          dataKey="value"
                          fill={`url(#kpiGradient${index})`}
                          stroke={cn({
                            "hsl(var(--heroui-primary))": color === "primary",
                            "hsl(var(--heroui-success))": color === "success",
                            "hsl(var(--heroui-warning))": color === "warning",
                            "hsl(var(--heroui-secondary))":
                              color === "secondary",
                          })}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </Card>
            ),
          )}
        </dl>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="tertiary" size="sm" onPress={exportPaymentsCsv}>
              <Icon icon="lucide:download" className="w-4 h-4" />
              Export CSV
            </Button>
            <SearchField name="search">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  className="sm:max-w-xs"
                  placeholder="Search by name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search by name or email"
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>

            <Input
              type="number"
              value={String(year)}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setYear(next);
              }}
              className="w-32"
            />
          </div>

          <ButtonGroup variant="outline">
            <Button
              onPress={() => setFilter("all")}
              variant={filter === "all" ? "primary" : "outline"}
            >
              All
            </Button>
            <Button
              onPress={() => setFilter("yearly")}
              variant={filter === "yearly" ? "primary" : "outline"}
            >
              Full
            </Button>
            <Button
              onPress={() => setFilter("handicap")}
              variant={filter === "handicap" ? "primary" : "outline"}
            >
              Handicap
            </Button>
            <Button
              onPress={() => setFilter("donation")}
              variant={filter === "donation" ? "primary" : "outline"}
            >
              Donation
            </Button>
          </ButtonGroup>
        </div>

        <Card className="mt-8 overflow-hidden">
          <Card.Header className="flex items-center justify-between">
            <div className="font-semibold">Paid Members</div>
            {isLoading ? <Spinner size="sm" /> : null}
          </Card.Header>
          <Card.Content className="p-0">
            {isMobileView ? (
              <div className="px-2 py-2">
                {!isLoading && filteredRows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-muted">
                    No payments found.
                  </div>
                ) : (
                  <Accordion allowsMultipleExpanded variant="surface">
                    {paginatedRows.map((row) => (
                      <AccordionItem
                        key={row.id}
                        aria-label={`Paid member ${row.name}`}
                      >
                        <Accordion.Heading>
                          <Accordion.Trigger>
                            <div className="min-w-0">
                              <div className="font-medium break-words">
                                {row.name}
                              </div>
                              <div className="text-xs text-muted break-all">
                                {row.email || "—"}
                              </div>
                            </div>
                            <Accordion.Indicator />
                          </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel>
                          <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
                            <div className="text-muted">Membership</div>
                            <div>
                              <Chip
                                size="sm"
                                variant="tertiary"
                                color={typeColor(row.membershipType)}
                              >
                                {typeLabel(row.membershipType)}
                              </Chip>
                            </div>
                            <div className="text-muted">Method</div>
                            <div>{methodLabel(row.method)}</div>
                            <div className="text-muted">Payment</div>
                            <div>{currency(row.paymentAmount)}</div>
                            <div className="text-muted">Donation</div>
                            <div>{currency(row.donationAmount)}</div>
                            <div className="text-muted">Paid</div>
                            <div>{formatDate(row.paidAt)}</div>
                          </div>
                        </Accordion.Panel>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            ) : (
              <div className="overflow-x-hidden">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-default/60">
                    <tr>
                      <th className="w-2/5 px-3 py-3 font-medium sm:w-auto sm:px-4">
                        Name
                      </th>
                      <th className="w-3/5 px-3 py-3 font-medium sm:w-auto sm:px-4 sm:min-w-[220px] sm:pr-8">
                        Email
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Membership Type
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Method
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Payment
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Donation
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Paid
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-3 break-words sm:px-4">
                          {row.name}
                        </td>
                        <td className="px-3 py-3 break-all sm:px-4 sm:pr-8">
                          {row.email || "—"}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Chip
                            size="sm"
                            variant="tertiary"
                            color={typeColor(row.membershipType)}
                          >
                            {typeLabel(row.membershipType)}
                          </Chip>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {methodLabel(row.method)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {currency(row.paymentAmount)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {currency(row.donationAmount)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {formatDate(row.paidAt)}
                        </td>
                      </tr>
                    ))}

                    {!isLoading && filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-muted"
                        >
                          No payments found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </Card.Content>
          {filteredRows.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-sm text-muted">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filteredRows.length)} of{" "}
                {filteredRows.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={page === 1}
                  onPress={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="tertiary"
                  isDisabled={page === totalPages}
                  onPress={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="mt-8 overflow-hidden">
          <Card.Header className="flex items-center justify-between">
            <div className="font-semibold">Pending Check Payments</div>
            {isLoading ? <Spinner size="sm" /> : null}
          </Card.Header>
          <Card.Content className="p-0">
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-default/60">
                  <tr>
                    <th className="w-2/5 px-3 py-3 font-medium sm:w-auto sm:px-4">
                      Name
                    </th>
                    <th className="w-3/5 px-3 py-3 font-medium sm:w-auto sm:px-4 sm:min-w-[220px] sm:pr-8">
                      Email
                    </th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">
                      Membership Type
                    </th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">
                      Amount
                    </th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">
                      Donation
                    </th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">
                      Requested
                    </th>
                    <th className="px-3 py-3 font-medium sm:px-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingChecks.map((r) => {
                    const user = userById.get(r.userId);
                    const name =
                      user?.displayName ||
                      [user?.firstName, user?.lastName]
                        .filter(Boolean)
                        .join(" ") ||
                      user?.email ||
                      r.userId;

                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-3 break-words sm:px-4">
                          {name}
                        </td>
                        <td className="px-3 py-3 break-all sm:px-4 sm:pr-8">
                          {user?.email || "—"}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Chip
                            size="sm"
                            variant="tertiary"
                            color={typeColor(r.membershipType)}
                          >
                            {typeLabel(r.membershipType)}
                          </Chip>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {currency(r.amount)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {currency(r.donationAmount)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          {formatDate(r.paidAt)}
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <Button
                            size="sm"
                            className="w-full sm:w-auto"
                            isDisabled={
                              confirmingGroupId === (r.groupId ?? r.id)
                            }
                            onPress={() =>
                              handleConfirmCheck(r.groupId ?? undefined, r.id)
                            }
                          >
                            Mark paid
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {!isLoading && pendingChecks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-center text-muted"
                      >
                        No pending check payments.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card.Content>
        </Card>

        {isAdmin ? (
          <Card className="mt-8">
            <Card.Header className="flex flex-col items-start gap-2">
              <div className="font-semibold">Bulk Record Check Payments</div>
              <div className="text-sm text-muted">
                Search for members and add them to the queue, then submit all at
                once. Members already paid this year are excluded.
              </div>
            </Card.Header>
            <Card.Content className="flex flex-col gap-4">
              {/* Add member row */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 min-w-0">
                  <UserSelect
                    users={bulkEligibleMembers}
                    label="Search member"
                    placeholder="Type name or email…"
                    value={bulkSelectedUserId}
                    onChange={(v) => {
                      const id = typeof v === "string" ? v : "";
                      setBulkSelectedUserId(id);
                      if (id) {
                        const member = allMembers.find((m) => m.id === id);
                        if (member?.membershipType) {
                          setBulkMembershipType(member.membershipType);
                        }
                      }
                    }}
                  />
                </div>
                <Select
                  aria-label="Membership type"
                  placeholder="Type"
                  className="sm:w-44"
                  value={bulkMembershipType}
                  onChange={(key) => {
                    const val = key as MembershipType;
                    if (val) setBulkMembershipType(val);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item
                        id={MEMBERSHIP_TYPES.FULL}
                        textValue="Full Membership"
                      >
                        Full Membership
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item
                        id={MEMBERSHIP_TYPES.HANDICAP}
                        textValue="Handicap Only"
                      >
                        Handicap Only
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Button
                  isDisabled={!bulkSelectedUserId}
                  onPress={() => {
                    if (!bulkSelectedUserId) return;
                    setBulkQueue((prev) => [
                      ...prev,
                      {
                        userId: bulkSelectedUserId,
                        membershipType: bulkMembershipType,
                      },
                    ]);
                    setBulkSelectedUserId("");
                  }}
                >
                  Add
                </Button>
              </div>

              {/* Queue table */}
              {bulkQueue.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-default/60">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Email</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Amount</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {bulkQueue.map((item) => {
                        const member = userById.get(item.userId);
                        const name =
                          member?.displayName ||
                          [member?.firstName, member?.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          member?.email ||
                          item.userId;
                        const fee =
                          item.membershipType === MEMBERSHIP_TYPES.HANDICAP
                            ? handicapFee
                            : fullFee;
                        return (
                          <tr key={item.userId} className="border-t">
                            <td className="px-4 py-2">{name}</td>
                            <td className="px-4 py-2 text-muted">
                              {member?.email || "—"}
                            </td>
                            <td className="px-4 py-2">
                              <Chip
                                size="sm"
                                variant="tertiary"
                                color={typeColor(item.membershipType)}
                              >
                                {typeLabel(item.membershipType)}
                              </Chip>
                            </td>
                            <td className="px-4 py-2">{currency(fee)}</td>
                            <td className="px-2 py-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label={`Remove ${name}`}
                                onPress={() =>
                                  setBulkQueue((prev) =>
                                    prev.filter(
                                      (q) => q.userId !== item.userId,
                                    ),
                                  )
                                }
                              >
                                <Icon icon="lucide:x" className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted">
                  No members queued. Use the search above to add members.
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between">
                {bulkQueue.length > 0 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => setBulkQueue([])}
                    isDisabled={submittingBulk}
                  >
                    Clear all
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  isDisabled={bulkQueue.length === 0}
                  onPress={handleBulkSubmit}
                >
                  Submit {bulkQueue.length > 0 ? bulkQueue.length : ""}{" "}
                  {bulkQueue.length === 1 ? "payment" : "payments"} by check
                </Button>
              </div>
            </Card.Content>
          </Card>
        ) : null}

        {isAdmin ? (
          <Card className="mt-8">
            <Card.Header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">PayPal Reconciliation</div>
                <div className="text-sm text-muted">
                  Checks for missed PayPal membership orders from the last 14
                  days.
                </div>
              </div>
              <Button variant="tertiary" onPress={handleReconcilePayPal}>
                Check PayPal orders
              </Button>
            </Card.Header>
            <Card.Content>
              {reconcileResult ? (
                <div className="space-y-3 text-sm">
                  <div>
                    Scanned {reconcileResult.scanned} transactions. Recorded{" "}
                    {reconcileResult.processed}. Skipped{" "}
                    {reconcileResult.skipped}.
                  </div>
                  {reconcileResult.errors.length > 0 ? (
                    <div>
                      <div className="font-medium text-danger-600">Errors</div>
                      <ul className="mt-2 list-disc pl-5 text-danger-600">
                        {reconcileResult.errors.map((item, index) => (
                          <li key={`err-${item.orderId ?? "unknown"}-${index}`}>
                            {item.orderId ?? "Unknown order"}: {item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {reconcileResult.skippedItems.length > 0 ? (
                    <div>
                      <div className="font-medium text-foreground">Skipped</div>
                      <ul className="mt-2 list-disc pl-5 text-muted">
                        {reconcileResult.skippedItems.map((item, index) => (
                          <li
                            key={`skip-${item.orderId ?? "unknown"}-${index}`}
                          >
                            {item.orderId ?? "Unknown order"}: {item.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted">
                  No reconciliation run yet.
                </div>
              )}
            </Card.Content>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
