import { Card, Skeleton } from "@heroui/react";

export type ProfileStat = {
  label: string;
  value: string;
  /** Tailwind text color class for the value. */
  tone?: string;
  isLoading?: boolean;
};

/** 2-up on phones, 4-up from `sm`. */
export function ProfileStats({ stats }: { stats: ProfileStat[] }) {
  return (
    <section
      aria-label="Stats"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
    >
      {stats.map((stat) => (
        <Card key={stat.label} className="gap-0.5 px-4 py-3">
          {stat.isLoading ? (
            <Skeleton className="my-1 h-7 w-16 rounded" />
          ) : (
            <p
              className={`text-2xl font-bold tabular-nums ${stat.tone ?? "text-foreground"}`}
            >
              {stat.value}
            </p>
          )}
          <p className="text-sm text-muted">{stat.label}</p>
        </Card>
      ))}
    </section>
  );
}
