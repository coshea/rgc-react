import { Skeleton } from "@heroui/react";
import { KPI } from "@heroui-pro/react/kpi";

export type ProfileStat = {
  label: string;
  value: number;
  /** Format the value as whole US dollars. */
  isCurrency?: boolean;
  /** Tailwind text color class for the value. */
  tone?: string;
  isLoading?: boolean;
  /** Change against an earlier period, shown as a trend chip. */
  trend?: { delta: number; label: string };
};

function trendDirection(delta: number) {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

/** 2-up on phones, 4-up from `sm`. */
export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return (
    <dl
      aria-label="Stats"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
    >
      {stats.map((stat) => (
        <KPI key={stat.label} className="gap-0.5 px-4 py-3">
          <KPI.Content>
            {stat.isLoading ? (
              <Skeleton className="my-1 h-7 w-16 rounded" />
            ) : (
              <KPI.Value
                value={stat.value}
                style={stat.isCurrency ? "currency" : "decimal"}
                currency={stat.isCurrency ? "USD" : undefined}
                maximumFractionDigits={0}
                className={`text-2xl font-bold tabular-nums ${stat.tone ?? "text-foreground"}`}
              />
            )}
          </KPI.Content>
          <KPI.Title className="text-sm font-normal text-muted">
            {stat.label}
          </KPI.Title>
          {stat.trend && !stat.isLoading && (
            <KPI.Trend
              trend={trendDirection(stat.trend.delta)}
              className="mt-1 self-start"
            >
              <span className="sr-only">
                {stat.trend.delta < 0 ? "Down " : "Up "}
              </span>
              {stat.isCurrency ? "$" : ""}
              {Math.abs(stat.trend.delta).toLocaleString()} {stat.trend.label}
            </KPI.Trend>
          )}
        </KPI>
      ))}
    </dl>
  );
}
