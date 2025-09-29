import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { siteConfig } from "@/config/site";

export const RequireAuth: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Checking access...</div>;
  }

  if (!user) {
    return (
      <Navigate
        to={siteConfig.pages.login.link}
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children;
};

export default RequireAuth;
