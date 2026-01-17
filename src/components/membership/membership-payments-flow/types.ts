export type MembershipOption = "renew" | "new" | "handicap" | "donation";

export type Step =
  | { kind: "select" }
  | { kind: "renew_lookup" }
  | { kind: "renew_confirm"; email: string; lastName?: string }
  | { kind: "new_apply" }
  | { kind: "handicap" }
  | { kind: "donation" }
  | {
      kind: "paypal";
      purpose: MembershipOption;
      title: string;
      description: string;
      amount: number;
    }
  | {
      kind: "done";
      title: string;
      description: string;
    };

export interface RenewLookupState {
  email: string;
  lastName: string;
}

export interface NewMemberState {
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  cityStateZip: string;
  ghin: string;
  homeCourse: string;
  acknowledged: boolean;
}

export interface HandicapState {
  fullName: string;
  email: string;
  ghin: string;
}

export interface DonationState {
  amount: string;
  name: string;
  email: string;
}
