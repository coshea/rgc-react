declare global {
  interface Window {
    grecaptcha: unknown;
  }
}

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? "";

type GrecaptchaEnterprise = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

type GrecaptchaV3 = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
  enterprise?: GrecaptchaEnterprise;
};

function isValidRecaptchaSiteKey(siteKey: string): boolean {
  const trimmed = siteKey.trim();
  if (!trimmed) return false;
  if (trimmed === "your_recaptcha_site_key_here") return false;
  return true;
}

function getGrecaptcha(): GrecaptchaV3 | undefined {
  if (!window.grecaptcha || typeof window.grecaptcha !== "object") {
    return undefined;
  }
  return window.grecaptcha as GrecaptchaV3;
}

/**
 * Executes reCAPTCHA Enterprise and returns a token.
 * @param action The action name to be used in reCAPTCHA.
 * @returns A promise that resolves with the reCAPTCHA token.
 */
export async function executeRecaptcha(action: string): Promise<string> {
  return new Promise((resolve) => {
    if (!isValidRecaptchaSiteKey(RECAPTCHA_SITE_KEY)) {
      console.warn(
        "reCAPTCHA is not configured (missing/placeholder VITE_RECAPTCHA_SITE_KEY).",
      );
      resolve("");
      return;
    }

    const grecaptcha = getGrecaptcha();
    const executor = grecaptcha?.enterprise ?? grecaptcha;

    if (!executor) {
      console.warn("reCAPTCHA not loaded yet.");
      resolve("");
      return;
    }

    try {
      executor.ready(async () => {
        try {
          const token = await executor.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (error) {
          console.error("reCAPTCHA execution failed:", error);
          resolve("");
        }
      });
    } catch (error) {
      console.error("reCAPTCHA ready failed:", error);
      resolve("");
    }
  });
}
