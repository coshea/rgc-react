import { describe, expect, it } from "vitest";
import {
  buildCurrentUserAvatar,
  resolveCurrentUserImageURL,
} from "@/utils/currentUserProfile";

const authUser = {
  uid: "user-123",
  displayName: "Auth User",
  email: "auth@example.com",
  photoURL: "https://example.com/google-photo.jpg",
};

describe("current user profile image resolution", () => {
  it("suppresses auth photo fallback while the profile query is pending", () => {
    expect(
      resolveCurrentUserImageURL(authUser, undefined, {
        allowAuthPhotoFallback: false,
      }),
    ).toBeNull();

    expect(
      buildCurrentUserAvatar(authUser, undefined, {
        allowAuthPhotoFallback: false,
      }),
    ).toMatchObject({
      id: "user-123",
      displayName: "Auth User",
      email: "auth@example.com",
      photoURL: undefined,
    });
  });

  it("prefers the uploaded profile image once the profile document resolves", () => {
    const userProfile = {
      displayName: "Profile User",
      photoURL: "https://example.com/uploaded-photo.jpg",
      profileURL: "https://example.com/uploaded-profile.jpg",
    };

    expect(resolveCurrentUserImageURL(authUser, userProfile)).toBe(
      "https://example.com/uploaded-profile.jpg",
    );

    expect(buildCurrentUserAvatar(authUser, userProfile)).toMatchObject({
      displayName: "Profile User",
      profileURL: "https://example.com/uploaded-profile.jpg",
      photoURL: "https://example.com/uploaded-photo.jpg",
    });
  });

  it("falls back to the auth photo only after the profile query resolves empty", () => {
    expect(
      resolveCurrentUserImageURL(authUser, null, {
        allowAuthPhotoFallback: true,
      }),
    ).toBe("https://example.com/google-photo.jpg");
  });
});
