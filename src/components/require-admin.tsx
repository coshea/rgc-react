import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useEffect, useState } from "react";
import { isAdminUser } from "@/utils/admin";

export const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [docAdmin, setDocAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    setChecking(true);
    if (user?.uid) {
      isAdminUser(user.uid)
        .then((flag) => {
          if (active) setDocAdmin(flag);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    } else {
      setDocAdmin(false);
      setChecking(false);
    }
    return () => {
      active = false;
    };
  }, [user?.uid]);

  if (checking) return <div>Checking access...</div>;

  const isAdmin = docAdmin === true;

  if (!user || !isAdmin) {
    // redirect to home if not authorized
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RequireAdmin;
