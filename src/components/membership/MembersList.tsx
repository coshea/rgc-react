import type { User } from "@/api/users";
import { MemberRow } from "./MemberRow";
import { MemberCardMobile } from "./MemberCardMobile";

interface MembersListProps {
  members: User[];
  filter: string;
  isAdmin: boolean;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}

export function MembersList({ members, filter, isAdmin, onEdit, onDelete }: MembersListProps) {
  const filtered = members.filter(m => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (m.displayName || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
  });
  return (
    <div className="bg-background rounded-lg shadow-sm">
      <div className="hidden md:grid items-center gap-4 p-4 border-b text-sm text-default-500 font-medium grid-cols-[2fr_4fr_2fr_2fr]">
        <div>NAME</div><div>EMAIL</div><div>PHONE</div>{isAdmin ? <div className="text-right pr-4">ACTIONS</div> : <div />}
      </div>
      <div className="divide-y">
        {filtered.map(m => (
          <div key={m.id}>
            <MemberRow user={m} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
            <MemberCardMobile user={m} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
          </div>
        ))}
      </div>
    </div>
  );
}
