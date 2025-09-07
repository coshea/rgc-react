import React from "react";
import { Navigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/providers/AuthProvider";

export const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { userProfile, isLoading } = useUserProfile();

  if (isLoading) return <div>Loading...</div>;

  const isAdmin = !!(userProfile && userProfile.admin === true);

  if (!user || !isAdmin) {
    // redirect to home if not authorized
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;
