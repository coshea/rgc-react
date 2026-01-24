import { ProfileForm } from "@/components/profile-form";
import { useAuth } from "@/providers/AuthProvider";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { Spinner } from "@heroui/react";
import { usePageTracking } from "@/hooks/usePageTracking";

const ProfilePage = () => {
  usePageTracking("Profile");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !user.emailVerified) {
      navigate(siteConfig.pages.verifyEmail.link);
    }
  }, [user?.emailVerified, loading]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" label="Loading profile..." />
      </div>
    );
  }
  if (user && !user.emailVerified) return null;
  return (
    <div className="p-6 max-w-3xl mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-4">Profile Information</h1>
      <ProfileForm onSaved={() => navigate(siteConfig.pages.home.link)} />
    </div>
  );
};

export default ProfilePage;
