import type { UserProfilePayload } from "@/api/users";

type AuthUserShape = {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber?: string | null;
  photoURL: string | null;
};

type AvatarUserShape = {
  id?: string;
  displayName?: string;
  email?: string;
  photoURL?: string | null;
  profileURL?: string | null;
};

type CurrentUserProfileState = UserProfilePayload | null | undefined;

type CurrentUserProfileOptions = {
  allowAuthPhotoFallback?: boolean;
};

export function resolveCurrentUserImageURL(
  user: AuthUserShape | null | undefined,
  userProfile: CurrentUserProfileState,
  options: CurrentUserProfileOptions = {},
): string | null {
  const allowAuthPhotoFallback =
    options.allowAuthPhotoFallback ?? userProfile !== undefined;

  if (userProfile?.profileURL) return userProfile.profileURL;
  if (userProfile?.photoURL) return userProfile.photoURL;
  if (allowAuthPhotoFallback) return user?.photoURL ?? null;
  return null;
}

export function buildCurrentUserAvatar(
  user: AuthUserShape | null | undefined,
  userProfile: CurrentUserProfileState,
  options: CurrentUserProfileOptions = {},
): AvatarUserShape | undefined {
  if (!user && !userProfile) return undefined;

  const allowAuthPhotoFallback =
    options.allowAuthPhotoFallback ?? userProfile !== undefined;

  return {
    id: user?.uid,
    displayName: userProfile?.displayName || user?.displayName || undefined,
    email: userProfile?.email || user?.email || undefined,
    profileURL: userProfile?.profileURL ?? undefined,
    photoURL:
      userProfile?.photoURL ??
      (allowAuthPhotoFallback ? (user?.photoURL ?? undefined) : undefined),
  };
}
