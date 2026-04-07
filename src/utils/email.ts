import { addToast } from "@/providers/toast";

/**
 * Copy an email list to the clipboard when it would exceed typical mailto
 * length limits (> 2000 chars), otherwise open a mailto: link directly.
 */
export async function copyOrMailtoEmails(emails: string[]): Promise<void> {
  if (!emails.length) {
    addToast({
      title: "No email addresses found",
      description: "Could not find email addresses for the selected members.",
      color: "warning",
    });
    return;
  }

  const emailString = emails.join(",");
  const isLarge = emailString.length > 2000;

  if (isLarge && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(emailString);
      addToast({
        title: "Emails copied to clipboard",
        description: `${emails.length} email addresses copied. Paste into your email client manually.`,
        color: "success",
      });
      return;
    } catch {
      // fall through to mailto
    }
  }

  window.location.href = `mailto:${emailString}`;
}
