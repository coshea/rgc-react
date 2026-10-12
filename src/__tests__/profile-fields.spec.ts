import { describe, it, expect } from "vitest";
import {
  profileFieldsFrom,
  toProfilePayload,
  validateProfileFields,
  type ProfileFields,
} from "@/components/profile/profile-fields";

const valid: ProfileFields = {
  firstName: "Pat",
  lastName: "Morgan",
  email: "pat@example.com",
  phone: "(203) 555-0142",
  ghinNumber: "1234567",
  tShirtSize: "L",
  defaultGoldTee: true,
};

describe("validateProfileFields", () => {
  it("accepts a complete profile", () => {
    expect(validateProfileFields(valid)).toEqual({});
  });

  it("flags required and malformed fields", () => {
    const errors = validateProfileFields({
      ...valid,
      firstName: " ",
      email: "nope",
      ghinNumber: "12a",
      tShirtSize: "XXL",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "email",
      "firstName",
      "ghinNumber",
      "tShirtSize",
    ]);
  });

  it("treats phone and GHIN as optional", () => {
    expect(
      validateProfileFields({ ...valid, phone: "", ghinNumber: "" }),
    ).toEqual({});
  });
});

describe("profileFieldsFrom", () => {
  it("falls back to auth data when no profile exists", () => {
    const fields = profileFieldsFrom(null, {
      displayName: "Jane Doe Smith",
      email: "jane@example.com",
    });
    expect(fields.firstName).toBe("Jane");
    expect(fields.lastName).toBe("Doe Smith");
    expect(fields.email).toBe("jane@example.com");
    expect(fields.defaultGoldTee).toBeUndefined();
  });
});

describe("toProfilePayload", () => {
  it("trims names, derives displayName and keeps the photo", () => {
    const payload = toProfilePayload(
      { ...valid, firstName: " Pat ", lastName: "Morgan " },
      "https://example.com/p.png",
    );
    expect(payload.firstName).toBe("Pat");
    expect(payload.displayName).toBe("Pat Morgan");
    expect(payload.photoURL).toBe("https://example.com/p.png");
    expect(payload.tShirtSize).toBe("L");
  });

  it("omits an unset gold-tee preference and invalid shirt size", () => {
    const payload = toProfilePayload(
      { ...valid, defaultGoldTee: undefined, tShirtSize: "" },
      null,
    );
    expect("defaultGoldTee" in payload).toBe(false);
    expect("tShirtSize" in payload).toBe(false);
  });
});
