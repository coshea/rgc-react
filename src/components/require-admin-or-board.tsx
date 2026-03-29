import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { isAdminUser } from "@/utils/admin";

/**
 * Route guard that allows access to admins OR board members.
 */
export const RequireAdminOrBoard: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const { user } = useAuth();
  const { userProfile, isLoading: loadingProfile } = useUserProfile();
  const [docAdmin, setDocAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    let active = true;
    setCheckingAdmin(true);
    if (user?.uid) {
      isAdminUser(user.uid)
        .then((flag) => {
          if (active) setDocAdmin(flag);
        })
        .finally(() => {
          if (active) setCheckingAdmin(false);
        });
    } else {
      setDocAdmin(false);
      setCheckingAdmin(false);
    }
    return () => {
      active = false;
    };
  }, [user?.uid]);

  if (checkingAdmin || loadingProfile) return <div>Checking access...</div>;

  const isAdmin = docAdmin === true;
  const isBoardMember = !!userProfile?.boardMember;

  if (!user || (!isAdmin && !isBoardMember)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdminOrBoard;
