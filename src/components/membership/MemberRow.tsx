import { Button, Tooltip } from "@heroui/react";
import { Link } from "react-router-dom";
import type { User } from "@/api/users";
import { UserAvatar } from "@/components/avatar";
import { formatPhone } from "@/utils/phone";

interface MemberRowProps {
  user: User;
  isAdmin: boolean;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
}

export function MemberRow({ user, isAdmin, onEdit, onDelete }: MemberRowProps) {
  const baseClasses = "hidden md:grid items-center gap-4 p-4 overflow-x-hidden";
  const grid = isAdmin
    ? "grid-cols-[2fr_3fr_2fr_2fr_2fr]"
    : "grid-cols-[2fr_3fr_2fr]";
  return (
    <div className={`${baseClasses} ${grid}`}>
      <div className="flex items-center gap-4">
        <Link
          to={`/profile/${user.id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <UserAvatar
            className="w-8 h-8"
            size="sm"
            userId={user.id}
            name={user.displayName || user.email}
            src={(user.photoURL as string) || undefined}
            alt={user.displayName || user.email}
          />
          <div className="text-sm text-default-500 hover:text-primary">
            {user.displayName || "(no name)"}
          </div>
        </Link>
      </div>
      <div className="text-sm text-default-500 whitespace-nowrap overflow-hidden text-ellipsis">
        {user.email}
      </div>
      <div className="text-sm text-default-500 whitespace-nowrap overflow-hidden text-ellipsis">
        {user.phone ? formatPhone(user.phone) : "—"}
      </div>
      {isAdmin && (
        <div className="text-sm text-default-500 whitespace-nowrap flex items-center gap-2">
          {user.membershipType ? (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                user.membershipType === "full"
                  ? "bg-success-100 text-success-600"
                  : "bg-primary-100 text-primary-600"
              }`}
            >
              {user.membershipType}
            </span>
          ) : (
            <span className="text-default-400 text-xs">—</span>
          )}
        </div>
      )}
      {isAdmin && (
        <div className="flex justify-end gap-2 pr-2">
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
