import { ProfileForm } from "@/components/profile-form";
import { useAuth } from "@/providers/AuthProvider";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { siteConfig } from "@/config/site";

const ProfilePage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !user.emailVerified) {
      navigate(siteConfig.pages.verifyEmail.link);
    }
  }, [user?.emailVerified, loading]);

  if (loading) return null;
  if (user && !user.emailVerified) return null;
  return (
    <div className="p-6 max-w-3xl mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-4">Profile Information</h1>
      <ProfileForm />
    </div>
  );
};

export default ProfilePage;
