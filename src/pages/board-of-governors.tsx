import React from "react";
import { Card, CardBody, CardHeader, Avatar, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { getUsers, User } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";

// Assumptions about User type extension:
// - user.role?: string (e.g., 'president', 'vice-president', 'secretary', etc.) or
// - user.boardRole?: string, using whichever exists.
// - user.boardMember?: boolean to flag board membership.
// Adjust mapping below if actual field names differ.

// Display ordering priority (case-insensitive) provided by requirements
// 1. President
// 2. Treasurer
// 3. Handicap Chairman
// 4. Webmaster
// 5. Board Member (generic / default board role)
// Remaining roles (legacy/unrecognized) sort after these alphabetically by role then name.
const ROLE_PRIORITY: string[] = [
  "president",
  "treasurer",
  "handicap chairman",
  "webmaster",
  "board member",
];

// Role metadata: icon, chip color, and display label overrides
const ROLE_META: Record<string, { icon: string; color: any; label?: string }> =
  {
    president: { icon: "lucide:crown", color: "warning", label: "President" },
    treasurer: {
      icon: "lucide:wallet",
      color: "secondary",
      label: "Treasurer",
    },
    "handicap chairman": {
      icon: "lucide:target",
      color: "success",
      label: "Handicap Chairman",
    },
    webmaster: { icon: "lucide:globe", color: "primary", label: "Webmaster" },
    "board member": {
      icon: "lucide:users",
      color: "default",
      label: "Board Member",
    },
  };

const prettyRole = (raw?: string) => {
  if (!raw) return "Board Member";
  const norm = raw.replace(/[-_]/g, " ").toLowerCase();
  const words = norm
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(" ");
};

const BoardOfGovernorsPage: React.FC = () => {
  useAuth(); // potential future personalization (auth context retained if needed later)
  const [loading, setLoading] = React.useState(true);
  const [boardMembers, setBoardMembers] = React.useState<User[]>([]);

  React.useEffect(() => {
    (async () => {
      try {
        const all = await getUsers();
        // Heuristics to determine board members & role fields
        const filtered = all.filter(
          (u: any) => u.boardMember || u.role || u.boardRole
        );
        // Sort: by ROLE_PRIORITY order; unknown roles get large index and are sorted alphabetically by role then name
        filtered.sort((a: any, b: any) => {
          const ra = (a.role || a.boardRole || "").toLowerCase();
          const rb = (b.role || b.boardRole || "").toLowerCase();
          const pa = ROLE_PRIORITY.indexOf(ra);
          const pb = ROLE_PRIORITY.indexOf(rb);
          if (pa !== pb) {
            const ai = pa === -1 ? 999 : pa;
            const bi = pb === -1 ? 999 : pb;
            if (ai !== bi) return ai - bi;
          }
          // If both unranked or same priority, secondary sort by role then name
          if (ra !== rb) return ra.localeCompare(rb);
          const na = (a.displayName || a.name || a.email || "").toLowerCase();
          const nb = (b.displayName || b.name || b.email || "").toLowerCase();
          return na.localeCompare(nb);
        });
        setBoardMembers(filtered);
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const president = boardMembers.find(
    (m: any) => (m.role || m.boardRole || "").toLowerCase() === "president"
  );

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

      {loading ? (
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {boardMembers.map((member: any) => {
            const role = (
              member.role ||
              member.boardRole ||
              "board member"
            ).toLowerCase();
            const meta = ROLE_META[role];
            const isPresident = role === "president";
            const avatarSrc =
              (member as any).profileURL || (member as any).photoURL;
            const initials = (
              member.displayName ||
              member.name ||
              member.email ||
              "?"
            )
              .split(" ")
              .map((s: string) => s[0])
              .slice(0, 2)
              .join("");
            const chipStart =
              !isPresident && meta ? (
                <Icon icon={meta.icon} className="w-3 h-3" />
              ) : undefined;
            return (
              <Card
                key={member.id}
                shadow="sm"
                className={`relative border border-default-200 bg-content1/60 hover:bg-content2 transition-colors ${
                  isPresident ? "ring-2 ring-warning" : ""
                }`}
              >
                <CardHeader className="pb-0 flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <Avatar
                      src={avatarSrc}
                      name={initials}
                      className={`w-20 h-20 text-large ${isPresident ? "border-2 border-warning" : ""}`}
                    >
                      {initials}
                    </Avatar>
                  </div>
                  <h3 className="font-semibold text-base">
                    {member.displayName || member.name || member.email}
                  </h3>
                  <div className="mt-2">
                    {meta ? (
                      <Chip
                        size="sm"
                        color={meta.color}
                        variant={isPresident ? "solid" : "flat"}
                        startContent={chipStart}
                      >
                        {meta.label || prettyRole(role)}
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="default">
                        {prettyRole(role)}
                      </Chip>
                    )}
                  </div>
                </CardHeader>
                <CardBody className="pt-4 text-sm text-center space-y-3">
                  {member.bio && (
                    <p className="text-xs text-foreground-500 line-clamp-4 leading-relaxed">
                      {member.bio}
                    </p>
                  )}
                  <div className="flex justify-center gap-2 flex-wrap">
                    {member.email && (
                      <Chip
                        size="sm"
                        variant="flat"
                        color="primary"
                        startContent={
                          <Icon icon="lucide:mail" className="w-3 h-3" />
                        }
                      >
                        Contact
                      </Chip>
                    )}
                  </div>
                </CardBody>
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
            {president.displayName || (president as any).name} leads the board
            in supporting member experience, fairness in competition, and
            long-term club success.
          </p>
        </div>
      )}
    </div>
  );
};

export default BoardOfGovernorsPage;
