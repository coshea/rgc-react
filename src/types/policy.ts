// Policy document types for admin-editable markdown pages

export enum PolicyType {
  HandicapPolicy = "handicap-policy",
  LocalRules = "local-rules",
}

export interface Policy {
  id: string;
  type: PolicyType;
  title: string;
  content: string; // Markdown content
  lastUpdatedBy?: string; // User ID
  lastUpdatedByName?: string; // User display name
  updatedAt?: Date;
  createdAt?: Date;
}

export const POLICY_LABELS: Record<PolicyType, string> = {
  [PolicyType.HandicapPolicy]: "RGC Handicap Policy",
  [PolicyType.LocalRules]: "Local Rules",
};
