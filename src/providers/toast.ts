// Centralized toast export so app code does not import from the UI library directly.
// This makes it easy to change providers in one place and matches our AI rules.
import { addToast as heroAddToast } from "@heroui/react";

export type ToastArgs = {
  title: string;
  description?: string;
  color?:
    | "success"
    | "danger"
    | "warning"
    | "primary"
    | "secondary"
    | "default";
  timeout?: number;
  shouldShowTimeoutProgress?: boolean;
};

const defaultToastOptions = {
  timeout: 6000,
  shouldShowTimeoutProgress: true,
} as const;

export const addToast = (args: ToastArgs) =>
  heroAddToast({ ...defaultToastOptions, ...args });
