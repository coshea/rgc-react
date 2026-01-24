import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { Icon } from "@iconify/react";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { usePageTracking } from "@/hooks/usePageTracking";

// Assumptions about User type extension:
// - user.role?: string (e.g., 'president', 'vice-president', 'secretary', etc.) or
// - user.boardRole?: string, using whichever exists.
// - user.boardMember?: boolean to flag board membership.
// Adjust mapping below if actual field names differ.

// prettyRole replaced by formatBoardRoleLabel from roles.ts

const BoardOfGovernorsPage: React.FC = () => {
  usePageTracking("Board of Governors");
  const navigate = useNavigate();
  const { boardMembers, president, isLoading } = useBoardMembers();

  return (
    <div className="max-w-6xl mx-auto px-4 pt-10 pb-24">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Board of Governors
        </h1>
        <p className="max-w-2xl mx-auto text-foreground-500 text-sm md:text-base leading-relaxed">
          Meet the elected board guiding the Ridgefield Golf Club. The board is
          responsible for governance, tournament oversight, and ensuring a
          vibrant, competitive, and welcoming community.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Icon
            icon="lucide:loader"
            className="animate-spin text-3xl text-primary"
          />
        </div>
      ) : boardMembers.length === 0 ? (
        <p className="text-center text-foreground-500">
          No board member data available.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {boardMembers.map((member) => {
            const meta = member.roleMeta;
            const isPresident = member.isPresident;
            const chipStart =
              !isPresident && meta ? (
                <Icon icon={meta.icon} className="w-3 h-3" />
              ) : undefined;

            return (
              <Card
                key={member.id}
                shadow="sm"
                isPressable
                onPress={() => navigate(`/profile/${member.id}`)}
                className={`relative border border-default-200 bg-content1/60 hover:bg-content2 transition-colors ${isPresident ? "ring-1 ring-warning" : ""}`}
              >
                <CardHeader className="py-3 flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <UserAvatar
                      user={member}
                      className={`w-10 h-10 text-small ${isPresident ? "border-2 border-warning" : ""}`}
                      size="sm"
                      alt={member.displayName || member.email}
                    />
                  </div>
                  <h3 className="font-semibold text-sm leading-tight">
                    {member.displayName || member.email}
                  </h3>
                  <div className="mt-2">
                    {meta ? (
                      <Chip
                        size="sm"
                        color={meta.color}
                        variant={isPresident ? "solid" : "flat"}
                        startContent={chipStart}
                      >
                        {meta.label || member.roleLabel}
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="default">
                        {member.roleLabel}
                      </Chip>
                    )}
                  </div>
                </CardHeader>
                <CardBody className="pt-0 pb-3" />
              </Card>
            );
          })}
        </div>
      )}
      {president && (
        <div className="mt-16 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3 flex items-center justify-center gap-2">
            <Icon icon="lucide:crown" className="w-6 h-6 text-warning" />
            Club President
          </h2>
          <p className="text-foreground-600 text-sm md:text-base leading-relaxed mb-4">
            {president.displayName || president.email} leads the board in
            supporting member experience, fairness in competition, and long-term
            club success.
          </p>
        </div>
      )}
    </div>
  );
};

export default BoardOfGovernorsPage;
