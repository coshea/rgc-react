import { useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, Spinner, cn } from "@heroui/react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "@iconify/react";

import { useMembers } from "@/hooks/useMembers";
import { useMembershipPayments } from "@/hooks/useMembershipPayments";
import { toDate } from "@/api/users";
import { MEMBERSHIP_TYPES } from "@@/types";
import { EmailMembersButton } from "@/components/membership";

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

// ─── Growth area chart (recharts + HeroUI theming) ───────────────────────────

interface GrowthLineChartProps {
  data: { year: number; count: number }[];
}

function GrowthLineChart({ data }: GrowthLineChartProps) {
  const chartData = data.map((d) => ({ year: d.year, value: d.count }));

  return (
    <div
      role="img"
      aria-label="Membership growth by year"
      className="w-full"
      style={{ height: 160 }}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        className="[&_.recharts-surface]:outline-hidden"
      >
        <AreaChart
          data={chartData}
          margin={{ top: 16, right: 8, left: 8, bottom: 24 }}
        >
          <defs>
            <linearGradient id="growthGradient" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="10%"
                stopColor="hsl(var(--heroui-primary))"
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--heroui-primary))"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "hsl(var(--heroui-default-400))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide allowDecimals={false} domain={[0, "auto"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--heroui-content1))",
              border: "1px solid hsl(var(--heroui-default-200))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => {
              const n = typeof value === "number" ? value : 0;
              return [`${n} member${n !== 1 ? "s" : ""}`, "Members"];
            }}
            labelFormatter={(label) => `Year: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={cn("hsl(var(--heroui-primary))")}
            fill="url(#growthGradient)"
            strokeWidth={2}
            dot={{
              r: 4,
              fill: "hsl(var(--heroui-primary))",
              stroke: "hsl(var(--heroui-background))",
              strokeWidth: 2,
            }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
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
        </>
      )}

      {/* Toolbar actions */}
      <div className="flex justify-end gap-2 flex-wrap">
        <EmailMembersButton
          members={allMembers}
          activeSet={activeSet}
          currentYear={year}
        />
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
