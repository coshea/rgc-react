import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionItem,
  Button,
  ButtonGroup,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import BackButton from "@/components/back-button";
import { addToast } from "@/providers/toast";
import { useAuth } from "@/providers/AuthProvider";

import { usePageTracking } from "@/hooks/usePageTracking";
import {
  confirmMembershipPaymentGroup,
  getMembershipSettings,
  reconcilePayPalMembershipOrders,
} from "@/api/membership";
import {
  MEMBERSHIP_TYPES,
  type MembershipType,
  type ReconcilePayPalOrdersResponse,
} from "@@/types";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { useMembers } from "@/hooks/useMembers";
import { HANDICAP_FEE, MEMBERSHIP_FEE } from "@/config/membership-pricing";
import { useDocAdminFlag } from "@/components/membership/hooks";

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

function typeColor(
  type?: MembershipType | string | null,
): "success" | "primary" | "default" {
  switch (type) {
    case MEMBERSHIP_TYPES.FULL:
      return "success";
    case MEMBERSHIP_TYPES.HANDICAP:
      return "primary";
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

export default function MembershipDashboardPage() {
  usePageTracking("Membership Dashboard");

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [confirmingGroupId, setConfirmingGroupId] = useState<string | null>(
    null,
  );
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] =
    useState<ReconcilePayPalOrdersResponse | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileView(event.matches);
    };

    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

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
    };
  }, [rows, payments]);

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

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold">Membership Dashboard</h1>
        <p className="mt-2 text-default-500">
          Payments recorded for {year}. Donations are tracked as separate
          transactions.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Payments</div>
              <div className="mt-2 text-2xl font-bold">{stats.total}</div>
              <div className="mt-1 text-sm text-default-500">
                Total: {currency(stats.totalAmount)}
              </div>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Full Membership</div>
              <div className="mt-2 text-2xl font-bold">{stats.yearly}</div>
              <div className="mt-1 text-sm text-default-500">
                Total: {currency(stats.yearlyAmount)}
              </div>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Handicap</div>
              <div className="mt-2 text-2xl font-bold">{stats.handicap}</div>
              <div className="mt-1 text-sm text-default-500">
                Total: {currency(stats.handicapAmount)}
              </div>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Donations</div>
              <div className="mt-2 text-2xl font-bold">{stats.donations}</div>
              <div className="mt-1 text-sm text-default-500">
                Total: {currency(stats.donationAmount)}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search by name or email"
              value={search}
              onValueChange={setSearch}
              className="sm:max-w-xs"
              startContent={<Icon icon="lucide:search" className="w-4 h-4" />}
            />
            <Input
              label="Year"
              type="number"
              value={String(year)}
              onValueChange={(v) => {
                const next = Number(v);
                if (!Number.isFinite(next)) return;
                setYear(next);
              }}
              className="w-32"
              min={2000}
              max={2100}
            />
          </div>

          <ButtonGroup variant="bordered">
            <Button
              onPress={() => setFilter("all")}
              color={filter === "all" ? "primary" : "default"}
            >
              All
            </Button>
            <Button
              onPress={() => setFilter("yearly")}
              color={filter === "yearly" ? "primary" : "default"}
            >
              Full
            </Button>
            <Button
              onPress={() => setFilter("handicap")}
              color={filter === "handicap" ? "primary" : "default"}
            >
              Handicap
            </Button>
            <Button
              onPress={() => setFilter("donation")}
              color={filter === "donation" ? "primary" : "default"}
            >
              Donation
            </Button>
          </ButtonGroup>
        </div>

        <Card className="mt-8 overflow-hidden" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <div className="font-semibold">Paid Members</div>
            {isLoading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="p-0">
            {isMobileView ? (
              <div className="px-2 py-2">
                {!isLoading && filteredRows.length === 0 ? (
                  <div className="px-4 py-10 text-center text-default-500">
                    No payments found.
                  </div>
                ) : (
                  <Accordion selectionMode="multiple" variant="splitted">
                    {filteredRows.map((row) => (
                      <AccordionItem
                        key={row.id}
                        aria-label={`Paid member ${row.name}`}
                        title={
                          <div className="min-w-0">
                            <div className="font-medium break-words">
                              {row.name}
                            </div>
                            <div className="text-xs text-default-500 break-all">
                              {row.email || "—"}
                            </div>
                          </div>
                        }
                      >
                        <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
                          <div className="text-default-500">Membership</div>
                          <div>
                            <Chip
                              size="sm"
                              variant="flat"
                              color={typeColor(row.membershipType)}
                            >
                              {typeLabel(row.membershipType)}
                            </Chip>
                          </div>
                          <div className="text-default-500">Payment</div>
                          <div>{currency(row.paymentAmount)}</div>
                          <div className="text-default-500">Donation</div>
                          <div>{currency(row.donationAmount)}</div>
                          <div className="text-default-500">Paid</div>
                          <div>{formatDate(row.paidAt)}</div>
                        </div>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            ) : (
              <div className="overflow-x-hidden">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-default-100">
                    <tr>
                      <th className="w-2/5 px-3 py-3 font-medium sm:w-auto sm:px-4">
                        Name
                      </th>
                      <th className="w-3/5 px-3 py-3 font-medium sm:w-auto sm:px-4">
                        Email
                      </th>
                      <th className="hidden px-4 py-3 font-medium sm:table-cell">
                        Membership Type
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
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-default-200">
                        <td className="px-3 py-3 break-words sm:px-4">
                          {row.name}
                        </td>
                        <td className="px-3 py-3 break-all sm:px-4">
                          {row.email || "—"}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Chip
                            size="sm"
                            variant="flat"
                            color={typeColor(row.membershipType)}
                          >
                            {typeLabel(row.membershipType)}
                          </Chip>
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
                          colSpan={6}
                          className="px-4 py-10 text-center text-default-500"
                        >
                          No payments found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="mt-8 overflow-hidden" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <div className="font-semibold">Pending Check Payments</div>
            {isLoading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-hidden">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-default-100">
                  <tr>
                    <th className="w-2/5 px-3 py-3 font-medium sm:w-auto sm:px-4">
                      Name
                    </th>
                    <th className="w-3/5 px-3 py-3 font-medium sm:w-auto sm:px-4">
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
                      <tr key={r.id} className="border-t border-default-200">
                        <td className="px-3 py-3 break-words sm:px-4">
                          {name}
                        </td>
                        <td className="px-3 py-3 break-all sm:px-4">
                          {user?.email || "—"}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Chip
                            size="sm"
                            variant="flat"
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
                            color="primary"
                            className="w-full sm:w-auto"
                            isLoading={
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
                        className="px-4 py-6 text-center text-default-500"
                      >
                        No pending check payments.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        {isAdmin ? (
          <Card className="mt-8" shadow="sm">
            <CardHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">PayPal Reconciliation</div>
                <div className="text-sm text-default-500">
                  Checks for missed PayPal membership orders from the last 14
                  days.
                </div>
              </div>
              <Button
                color="primary"
                variant="flat"
                onPress={handleReconcilePayPal}
                isLoading={reconciling}
              >
                Check PayPal orders
              </Button>
            </CardHeader>
            <CardBody>
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
                      <div className="font-medium text-default-600">
                        Skipped
                      </div>
                      <ul className="mt-2 list-disc pl-5 text-default-500">
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
                <div className="text-sm text-default-500">
                  No reconciliation run yet.
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
