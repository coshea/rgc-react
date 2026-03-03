import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Skeleton } from "@heroui/react";
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
    return (
      <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-[90vw] rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
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
