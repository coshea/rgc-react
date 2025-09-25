import { Button, Tooltip } from "@heroui/react";
import type { User } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { formatPhone } from "@/utils/phone";

interface MemberCardMobileProps {
  user: User;
  isAdmin: boolean;
  isActive: boolean;
  activeYear: number;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}

export function MemberCardMobile({
  user,
  isAdmin,
  isActive,
  activeYear,
  onEdit,
  onDelete,
}: MemberCardMobileProps) {
  return (
  <div className="block md:hidden p-4 w-full overflow-x-hidden break-words">
  <div className="flex items-center gap-4 mb-2 min-w-0">
        <UserAvatar
          className="w-8 h-8"
          size="sm"
          userId={user.id}
          name={user.displayName || user.email}
          src={(user.photoURL as string) || undefined}
          alt={user.displayName || user.email}
        />
        <div className="text-sm text-default-500 font-medium truncate">
          {user.displayName || "(no name)"}
        </div>
      </div>
      <div className="text-sm text-default-500 mb-1 flex items-center gap-2 whitespace-normal break-words">
        <span className="font-medium">Email:</span>
        <span className="block break-words whitespace-normal">
          {user.email}
        </span>
      </div>
      <div className="text-sm text-default-500">
        <span className="font-medium">Phone: </span>
        <span>{user.phone ? formatPhone(user.phone) : "—"}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {isActive ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-success-100 text-success-600 font-medium">
            Active {activeYear}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-default-100 text-default-500 font-medium">
            Inactive
          </span>
        )}
        {user.membershipType && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary-100 text-primary-600 font-medium capitalize">
            {user.membershipType}
          </span>
        )}
      </div>
      {isAdmin && (
        <div className="mt-3 flex gap-3 flex-row flex-wrap">
          <Tooltip content="Edit member">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={() => onEdit(user)}
              aria-label="Edit member"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-default-600"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.375-9.375Z" />
              </svg>
            </Button>
          </Tooltip>
          <Tooltip content="Delete member" color="danger">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              onPress={() => onDelete(user)}
              aria-label="Delete member"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
              </svg>
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
