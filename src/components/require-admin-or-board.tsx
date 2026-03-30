import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import {
  useAdminFlag,
  useBoardMemberFlag,
} from "@/components/membership/hooks";

/**
 * Route guard that allows access to admins OR board members.
 */
export const RequireAdminOrBoard: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const { user } = useAuth();
  const { isAdmin, loadingAdmin } = useAdminFlag(user);
  const { isBoardMember, loadingBoard } = useBoardMemberFlag(user);

  if (loadingAdmin || loadingBoard) {
    return <div>Checking access...</div>;
  }

  if (!user || (!isAdmin && !isBoardMember)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdminOrBoard;
