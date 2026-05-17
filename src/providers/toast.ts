// Centralized toast export so app code does not import from the UI library directly.
// This makes it easy to change providers in one place and matches our AI rules.
import { toast } from "@heroui/react";

export type ToastArgs = {
  title: string;
  description?: string;
  color?:
    | "success"
    | "danger"
    | "warning"
    | "default"
    | "accent"
    | "primary"
    | "secondary";
};

/**
 * Wrapper around the HeroUI v3 toast() function.
 * Maps legacy `color` values to v3 helper methods so all call-sites stay unchanged.
 */
export const addToast = ({ title, description, color }: ToastArgs): void => {
  const opts = description ? { description } : undefined;
  switch (color) {
    case "success":
      toast.success(title, opts);
      break;
    case "danger":
      toast.danger(title, opts);
      break;
    case "warning":
      toast.warning(title, opts);
      break;
    default:
      toast(title, opts);
  }
};
