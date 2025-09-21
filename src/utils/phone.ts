// Phone utility functions centralizing normalization and formatting logic.
// Follow project convention: export small pure helpers, no external deps.

/** Strip all non-digit characters from a phone-like string. */
export function normalizePhone(value?: string | null): string {
  if (!value) return "";
  return String(value).replace(/\D/g, "");
}

/**
 * Format a (US) phone number for display.
 * - 10 digits => (xxx) xxx-xxxx
 * - 7 digits  => xxx-xxxx
 * - otherwise => trimmed original (if provided) or empty string
 */
export function formatPhone(value?: string | null): string {
  if (!value) return "";
  const digits = normalizePhone(value);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return value.trim();
}
