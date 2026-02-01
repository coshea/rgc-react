import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import { siteConfig } from "@/config/site";
import { isProfileComplete } from "@/utils/profileCompletion";

const allowedPaths = new Set<string>([
  siteConfig.pages.profile.link,
  "/profile/edit",
  siteConfig.pages.verifyEmail.link,
  siteConfig.pages.login.link,
  siteConfig.pages.signup.link,
]);

const ProfileCompletionGate: React.FC = () => {
  const { user, loading } = useAuth();
  const { userProfile, isLoading } = useUserProfile();
  const location = useLocation();

  if (loading || (user && isLoading)) {
    return null;
  }

  if (!user) {
    return <Outlet />;
  }

  if (!user.emailVerified) {
    return <Outlet />;
  }

  const isAllowedPath =
    allowedPaths.has(location.pathname) ||
    location.pathname.startsWith("/profile/");

  if (!isProfileComplete(userProfile) && !isAllowedPath) {
    return (
      <Navigate
        to={siteConfig.pages.profile.link}
        replace
        state={{
          message:
            "Please complete your profile (first and last name) to continue.",
          from: location.pathname + location.search,
        }}
      />
    );
  }

  return <Outlet />;
};

export default ProfileCompletionGate;
