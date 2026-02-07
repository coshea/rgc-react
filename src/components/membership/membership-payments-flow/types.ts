export type MembershipOption = "renew" | "new" | "handicap" | "donation";

export type Step =
  | { kind: "select" }
  | { kind: "annual_start" }
  | { kind: "renew_confirm"; email: string; lastName?: string }
  | { kind: "new_apply" }
  | { kind: "handicap" }
  | { kind: "handicap_confirm" }
  | { kind: "donation" }
  | {
      kind: "paypal";
      purpose: MembershipOption;
      title: string;
      description: string;
      amount: number;
      returnTo: Step;
    }
  | {
      kind: "done";
      title: string;
      description: string;
    };

export interface NewMemberState {
  acknowledged: boolean;
}

export interface HandicapState {
  ghin: string;
}

export interface DonationState {
  amount: string;
  name: string;
  email: string;
}

export interface RenewLookupState {
  email: string;
  lastName: string;
}
