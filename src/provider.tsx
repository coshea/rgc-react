import type { NavigateOptions } from "react-router-dom";

import { HeroUIProvider } from "@heroui/system";
import { ToastProvider } from "@heroui/react";
import { useHref, useNavigate } from "react-router-dom";
import { AuthProvider } from "./providers/AuthProvider";

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

export function Provider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <AuthProvider>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        {/* Global toast provider so addToast calls render */}
        <div className="z-[9999] relative">
          <ToastProvider placement="bottom-center" />
        </div>
        {children}
      </HeroUIProvider>
    </AuthProvider>
  );
}
