import { ProfileForm } from "@/components/profile-form";
import { useAuth } from "@/providers/AuthProvider";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { siteConfig } from "@/config/site";
import { Spinner } from "@heroui/react";
import { usePageTracking } from "@/hooks/usePageTracking";

const ProfilePage = () => {
  usePageTracking("Profile");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as { message?: string };

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
      {state.message && (
        <div className="mb-4 rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-warning-900">
          {state.message}
        </div>
      )}
      <h1 className="text-2xl font-semibold mb-4">Profile Information</h1>
      <ProfileForm
        hideCancelWhenNew
        onSaved={() => navigate(siteConfig.pages.home.link)}
      />
    </div>
  );
};

export default ProfilePage;
