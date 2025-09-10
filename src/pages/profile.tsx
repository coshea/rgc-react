import { ProfileForm } from "@/components/profile-form";

const ProfilePage = () => {
  return (
    <div className="p-6 max-w-3xl mx-auto text-center">
      <h1 className="text-2xl font-semibold mb-4">Profile Information</h1>
      <ProfileForm />
    </div>
  );
};

export default ProfilePage;
