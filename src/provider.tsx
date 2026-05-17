import { Toast } from "@heroui/react";
import { AuthProvider } from "@/providers/AuthProvider";
import { ConsentProvider } from "@/providers/ConsentProvider";
import ConsentBanner from "@/components/consent-banner";

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ConsentProvider>
      <AuthProvider>
        {/* Global toast provider so toast() calls render */}
        <Toast.Provider placement="bottom" />
        {/* Cookie consent banner (fixed) */}
        <ConsentBanner />
        {children}
      </AuthProvider>
    </ConsentProvider>
  );
}
