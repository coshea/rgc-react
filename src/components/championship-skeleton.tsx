import { Card,   Skeleton } from "@heroui/react";

export function ChampionshipCardSkeleton() {
  return (
    <Card className="w-full">
      <Card.Header className="flex flex-col gap-2">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
        <Skeleton className="h-4 w-24 rounded-lg" />
      </Card.Header>

      <Card.Content className="space-y-3">
        {/* Winner skeleton */}
        <div className="flex items-center gap-3 p-3 rounded-md bg-surface">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-3 w-16 rounded-lg" />
          </div>
        </div>

        {/* Runner-up skeleton */}
        <div className="flex items-center gap-3 p-3 rounded-md bg-surface-secondary">
          <Skeleton className="w-12 h-12 rounded-full opacity-80" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-3 w-14 rounded-lg" />
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

export function ChampionshipYearGroupSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-16 rounded-lg" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <ChampionshipCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function ChampionshipsListSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 overflow-x-hidden">
      {Array.from({ length: 3 }).map((_, index) => (
        <ChampionshipYearGroupSkeleton key={index} />
      ))}
    </div>
  );
}
