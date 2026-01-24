import { ProfileForm } from "@/components/profile-form";
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
        <Spinner size="lg" label="Loading profile..." />
      </div>
    );
  }

  if (!user) return null;

  if (user && !user.emailVerified) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <BackButton />
        <h1 className="text-xl font-semibold">Edit Profile</h1>
        <div className="w-10" />
      </div>

      <ProfileForm onSaved={() => navigate(siteConfig.pages.home.link)} />
    </div>
  );
};

export default ProfileEditPage;
