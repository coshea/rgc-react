// EmailJS Configuration
// Get your credentials from https://dashboard.emailjs.com/admin

export const EMAILJS_CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || "",
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "",
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "",
};

// Validate configuration
export function isEmailJSConfigured(): boolean {
  const isValid =
    EMAILJS_CONFIG.serviceId &&
    EMAILJS_CONFIG.templateId &&
    EMAILJS_CONFIG.publicKey &&
    EMAILJS_CONFIG.serviceId !== "YOUR_SERVICE_ID" &&
    EMAILJS_CONFIG.templateId !== "YOUR_TEMPLATE_ID" &&
    EMAILJS_CONFIG.publicKey !== "YOUR_PUBLIC_KEY" &&
    EMAILJS_CONFIG.serviceId.startsWith("service_") &&
    EMAILJS_CONFIG.templateId.startsWith("template_");

  // Debug logging (remove in production)
  if (!isValid) {
    console.log("EmailJS Config Debug:", {
      serviceId: EMAILJS_CONFIG.serviceId,
      templateId: EMAILJS_CONFIG.templateId,
      publicKey: EMAILJS_CONFIG.publicKey?.substring(0, 5) + "...",
    });
  }

  return isValid;
}
