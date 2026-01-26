import { useMemo, useState } from "react";
import {
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
import { useQuery } from "@tanstack/react-query";

import BackButton from "@/components/back-button";

import { usePageTracking } from "@/hooks/usePageTracking";
import { getMembershipSettings } from "@/api/membership";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { useMembers } from "@/hooks/useMembers";
import { HANDICAP_FEE, MEMBERSHIP_FEE } from "@/config/membership-pricing";

type Filter = "all" | "yearly" | "handicap" | "donation";

function typeLabel(type?: string | null) {
  switch (type) {
    case "full":
      return "Yearly Membership";
    case "handicap":
      return "Handicap Membership";
    default:
      return type ?? "—";
  }
}

function currency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function MembershipDashboardPage() {
  usePageTracking("Membership Dashboard");

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

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
    const confirmed = (payments || []).filter((p) => p.status === "confirmed");

    return confirmed
      .map((p) => {
        const user = userById.get(p.userId);
        const name =
          user?.displayName ||
          [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
          user?.email ||
          p.userId;

        const baseFee = p.membershipType === "handicap" ? handicapFee : fullFee;
        const donationAmount =
          p.amount != null && Number.isFinite(p.amount)
            ? Math.max(0, p.amount - baseFee)
            : 0;

        return {
          id: `${p.userId}_${p.year}`,
          userId: p.userId,
          name,
          email: user?.email || "",
          membershipType: p.membershipType,
          paymentAmount: p.amount ?? null,
          donationAmount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [payments, userById, fullFee, handicapFee]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q);

      const matchesType =
        filter === "all" ||
        (filter === "yearly" && r.membershipType === "full") ||
        (filter === "handicap" && r.membershipType === "handicap") ||
        (filter === "donation" && r.donationAmount > 0);

      return matchesSearch && matchesType;
    });
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      yearly: rows.filter((r) => r.membershipType === "full").length,
      handicap: rows.filter((r) => r.membershipType === "handicap").length,
      donations: rows.filter((r) => r.donationAmount > 0).length,
    };
  }, [rows]);

  const isLoading = loadingMembers || loadingPayments;

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <BackButton />
        </div>
        <h1 className="text-3xl font-bold">Membership Dashboard</h1>
        <p className="mt-2 text-default-500">
          Payments recorded for {year}. Donation amount is inferred as (payment
          − base fee).
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-4">
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Total Paid</div>
              <div className="mt-2 text-2xl font-bold">{stats.total}</div>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Yearly</div>
              <div className="mt-2 text-2xl font-bold">{stats.yearly}</div>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Handicap</div>
              <div className="mt-2 text-2xl font-bold">{stats.handicap}</div>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardBody className="p-6">
              <div className="text-sm text-default-500">Donations</div>
              <div className="mt-2 text-2xl font-bold">{stats.donations}</div>
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
              Yearly
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

        <Divider className="mt-8" />

        <Card className="mt-8 overflow-hidden" shadow="sm">
          <CardHeader className="flex items-center justify-between">
            <div className="font-semibold">Paid Members</div>
            {isLoading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-default-100">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Membership Type</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Donation</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.id} className="border-t border-default-200">
                      <td className="px-4 py-3">{r.name}</td>
                      <td className="px-4 py-3">{r.email || "—"}</td>
                      <td className="px-4 py-3">
                        <Chip size="sm" variant="flat" color="primary">
                          {typeLabel(r.membershipType)}
                        </Chip>
                      </td>
                      <td className="px-4 py-3">{currency(r.paymentAmount)}</td>
                      <td className="px-4 py-3">
                        {currency(r.donationAmount)}
                      </td>
                    </tr>
                  ))}

                  {!isLoading && filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-default-500"
                      >
                        No payments found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
