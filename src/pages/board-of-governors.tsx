import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Card, Spinner } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { usePageTracking } from "@/hooks/usePageTracking";
import { EmptyStateMessage } from "@/components/empty-state-message";

const BoardOfGovernorsPage: React.FC = () => {
  usePageTracking("Board of Governors");
  const { boardMembers, isLoading } = useBoardMembers();

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-24 sm:pt-12">
      <header className="mb-8 max-w-2xl sm:mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Board of Governors
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
          Meet the board guiding the Ridgefield Golf Club. The board is
          responsible for governance, tournament oversight, and keeping the club
          a vibrant, competitive, and welcoming community.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner aria-label="Loading board members" />
        </div>
      ) : boardMembers.length === 0 ? (
        <EmptyStateMessage
          icon="lucide:users"
          title="No board members are listed yet"
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {boardMembers.map((member) => {
            const name = member.displayName || member.email;
            return (
              <li key={member.id}>
                <RouterLink
                  to={`/profile/${member.id}`}
                  aria-label={`View profile for ${name}`}
                  className="block h-full rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Card className="h-full items-center gap-3 px-3 py-6 text-center transition-colors hover:bg-surface-secondary sm:gap-4 sm:px-5 sm:py-8">
                    <UserAvatar
                      user={member}
                      size="lg"
                      className="size-20 text-2xl sm:size-28 sm:text-4xl"
                      alt={name}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight sm:text-lg">
                        {name}
                      </p>
                      <p className="mt-1 text-sm text-muted sm:text-base">
                        {member.roleMeta?.label || member.roleLabel}
                      </p>
                    </div>
                  </Card>
                </RouterLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BoardOfGovernorsPage;
