import { addToast } from "@/providers/toast";

/**
 * Copy an email list to the clipboard when it would exceed typical mailto
 * length limits (> 2000 chars), otherwise open a mailto: link directly.
 */
export async function copyOrMailtoEmails(emails: string[]): Promise<void> {
  const seen = new Set<string>();
  const normalized = emails
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && !seen.has(e) && seen.add(e));

  if (!normalized.length) {
    addToast({
      title: "No email addresses found",
      description: "Could not find email addresses for the selected members.",
      color: "warning",
    });
    return;
  }

  const emailString = normalized.join(",");
  const isLarge = emailString.length > 2000;

  if (isLarge && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(emailString);
      addToast({
        title: "Emails copied to clipboard",
        description: `${normalized.length} email addresses copied. Paste into your email client manually.`,
        color: "success",
      });
      return;
    } catch (err) {
      console.warn(
        "[copyOrMailtoEmails] Clipboard write failed, falling back to mailto:",
        err,
      );
      addToast({
        title: "Clipboard unavailable",
        description:
          "Could not copy to clipboard. Opening your email client instead.",
        color: "warning",
      });
      // fall through to mailto
    }
  }

  window.location.href = `mailto:${normalized.join(",")}`;
}
