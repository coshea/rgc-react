import { ProfileForm } from "@/components/profile-form";
import { ProfileSettingsList } from "@/components/profile/profile-settings-list";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import BackButton from "@/components/back-button";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/providers/AuthProvider";
import { Spinner } from "@heroui/react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTracking } from "@/hooks/usePageTracking";

const ProfileEditPage = () => {
  usePageTracking("Edit Profile");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { userProfile } = useUserProfile();
  // Phones edit one field at a time; first-time setup (no profile doc yet)
  // always uses the full form so every required field gets filled in.
  const isPhone = useMediaQuery("(max-width: 640px)");
  const useSettingsList = isPhone && userProfile != null;

  useEffect(() => {
    if (!loading && !user) {
      navigate(siteConfig.pages.login.link, {
        state: {
          from: "/profile/edit",
          message: "You must be logged in to edit your profile",
        },
        replace: true,
      });
      return;
    }

    if (!loading && user && !user.emailVerified) {
      navigate(siteConfig.pages.verifyEmail.link, { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" aria-label="Loading profile..." />
      </div>
    );
  }

  if (!user) return null;

  if (user && !user.emailVerified) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <BackButton />
        <h1 className="text-xl font-semibold sm:text-2xl">Edit Profile</h1>
        <div className="w-10" />
      </div>

      {useSettingsList ? (
        <ProfileSettingsList />
      ) : (
        <ProfileForm onSaved={() => navigate(-1)} />
      )}
    </div>
  );
};

export default ProfileEditPage;
