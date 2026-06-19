import { addToast } from "@/providers/toast";

/**
 * Copy an email list to the clipboard.
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
  const clipboard =
    typeof navigator === "undefined" ? undefined : navigator.clipboard;

  if (!clipboard) {
    addToast({
      title: "Copy failed",
      description: "Could not copy email addresses to clipboard.",
      color: "danger",
    });
    return;
  }

  try {
    await clipboard.writeText(emailString);
    addToast({
      title: "Emails copied to clipboard",
      description: `${normalized.length} email address${normalized.length === 1 ? "" : "es"} copied.`,
      color: "success",
    });
  } catch (err) {
    console.error("[copyOrMailtoEmails] Clipboard write failed:", err);
    addToast({
      title: "Copy failed",
      description: "Could not copy email addresses to clipboard.",
      color: "danger",
    });
  }
}
