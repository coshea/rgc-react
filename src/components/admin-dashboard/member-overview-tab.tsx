import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";

import { useMembers } from "@/hooks/useMembers";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { toDate } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";

// ─── helpers ──────────────────────────────────────────────────────────────────

function resolvedName(
  m: ReturnType<typeof useMembers>["allMembers"][number],
): string {
  return (
    m.displayName ||
    [m.firstName, m.lastName].filter(Boolean).join(" ") ||
    m.email ||
    m.id
  );
}

/** Simple in-browser CSV download – no external deps. */
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Growth bar chart (pure CSS, no Chart.js dependency) ─────────────────────

interface GrowthLineChartProps {
  data: { year: number; count: number }[];
}

function GrowthLineChart({ data }: GrowthLineChartProps) {
  const W = 600;
  const H = 120;
  const padX = 24;
  const padY = 16;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;

  const max = Math.max(...data.map((d) => d.count), 1);
  const n = data.length;

  const x = (i: number) =>
    padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (count: number) => padY + innerH - (count / max) * innerH;

  const points = data.map((d, i) => ({ ...d, cx: x(i), cy: y(d.count) }));

  // SVG polyline points string
  const linePoints = points.map((p) => `${p.cx},${p.cy}`).join(" ");

  // Filled area path: line down then back along bottom
  const areaPath =
    `M${points[0].cx},${y(0)} ` +
    points.map((p) => `L${p.cx},${p.cy}`).join(" ") +
    ` L${points[points.length - 1].cx},${y(0)} Z`;

  return (
    <div role="img" aria-label="Membership growth by year">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 120 }}
        overflow="visible"
      >
        {/* Filled area under the line */}
        <path d={areaPath} className="fill-primary/10" />
        {/* Line */}
        <polyline
          points={linePoints}
          className="fill-none stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Data points with tooltips via <title> */}
        {points.map((p) => (
          <g key={p.year}>
            <circle
              cx={p.cx}
              cy={p.cy}
              r={5}
              className="fill-primary stroke-background"
              strokeWidth={2}
            />
            <title>{`${p.year}: ${p.count} member${p.count !== 1 ? "s" : ""}`}</title>
            {/* Value label above point */}
            <text
              x={p.cx}
              y={p.cy - 10}
              textAnchor="middle"
              className="fill-default-500"
              fontSize={11}
              fontWeight={500}
            >
              {p.count}
            </text>
            {/* Year label below chart */}
            <text
              x={p.cx}
              y={H + 14}
              textAnchor="middle"
              className="fill-default-400"
              fontSize={10}
            >
              {p.year}
            </text>
          </g>
        ))}
      </svg>
      {/* Spacer for year labels rendered outside the SVG viewBox */}
      <div style={{ height: 18 }} />
    </div>
  );
}

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

  // ── growth chart data ─────────────────────────────────────────────────────────

  const growthData = useMemo(() => {
    const startYear = 2025;
    const years: Record<number, number> = {};
    for (const m of allMembers) {
      const lpy = typeof m.lastPaidYear === "number" ? m.lastPaidYear : null;
      if (lpy !== null && lpy >= startYear && lpy <= currentYear) {
        years[lpy] = (years[lpy] ?? 0) + 1;
      }
    }
    const length = currentYear - startYear + 1;
    return Array.from({ length }, (_, i) => {
      const y = startYear + i;
      return { year: y, count: years[y] ?? 0 };
    });
  }, [allMembers, currentYear]);

  // ── CSV export ────────────────────────────────────────────────────────────────

  function exportMemberList() {
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Membership Type",
      "Last Paid Year",
      "Status",
    ];
    const dataRows = allMembers.map((m) => [
      resolvedName(m),
      m.email ?? "",
      m.phone ?? "",
      m.membershipType ?? "",
      String(m.lastPaidYear ?? ""),
      activeSet.has(m.id) ? "Active" : "Inactive",
    ]);
    downloadCsv(`rgc-members-${year}.csv`, [headers, ...dataRows]);
  }

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
            onPress={() => setYear((y) => y - 1)}
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

          {/* Growth chart */}
          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Membership Growth</p>
                <p className="text-xs text-default-400">
                  Members active per year (by last paid year)
                </p>
              </div>
            </CardHeader>
            <CardBody className="px-6 pb-6">
              <GrowthLineChart data={growthData} />
            </CardBody>
          </Card>

          {/* Membership type breakdown */}
          <Card shadow="sm">
            <CardHeader>
              <p className="font-semibold">Membership Type Breakdown</p>
            </CardHeader>
            <CardBody className="flex flex-wrap gap-3 pb-5">
              <div className="flex items-center gap-2">
                <Chip color="success" variant="flat" size="sm">
                  Full
                </Chip>
                <span className="text-sm font-medium">{stats.fullMembers}</span>
              </div>
              <div className="flex items-center gap-2">
                <Chip color="primary" variant="flat" size="sm">
                  Handicap Only
                </Chip>
                <span className="text-sm font-medium">
                  {stats.handicapOnly}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Chip color="default" variant="flat" size="sm">
                  No Type Set
                </Chip>
                <span className="text-sm font-medium">
                  {stats.total - stats.fullMembers - stats.handicapOnly}
                </span>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* Export action */}
      <div className="flex justify-end">
        <Button
          variant="flat"
          color="primary"
          startContent={<Icon icon="lucide:download" className="w-4 h-4" />}
          onPress={exportMemberList}
          isDisabled={isLoading || allMembers.length === 0}
        >
          Export Member List
        </Button>
      </div>
    </div>
  );
}
