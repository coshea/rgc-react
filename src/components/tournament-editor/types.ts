export type TeeColor = "Blue" | "White" | "Gold" | "Red" | "Mixed";
export const TEE_COLORS: TeeColor[] = ["Blue", "White", "Gold", "Red", "Mixed"];

export function isTeeColor(value: unknown): value is TeeColor {
  return TEE_COLORS.includes(value as TeeColor);
}

export interface TournamentRegistration {
  id: string;
  ownerId?: string;
  team?: Array<{
    id: string;
    displayName?: string;
    goldTee?: boolean;
  }>;
  openSpotsOptIn?: boolean;
  registeredAt?: unknown;
}

export interface TournamentEditorFormState {
  isSubmitting: boolean;
}
