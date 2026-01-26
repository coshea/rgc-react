declare global {
  interface Window {
    grecaptcha: any;
  }
}

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

/**
 * Executes reCAPTCHA Enterprise and returns a token.
 * @param action The action name to be used in reCAPTCHA.
 * @returns A promise that resolves with the reCAPTCHA token.
 */
export async function executeRecaptcha(action: string): Promise<string> {
  return new Promise((resolve) => {
    if (!window.grecaptcha || !window.grecaptcha.enterprise) {
      console.warn("reCAPTCHA not loaded yet.");
      resolve("");
      return;
    }

    try {
      window.grecaptcha.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha.enterprise.execute(
            RECAPTCHA_SITE_KEY,
            {
              action,
            },
          );
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
