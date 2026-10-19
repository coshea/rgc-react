import { MainNavbar as MainNavbar } from "@/components/navbar-with-avatar";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineWarmup } from "@/components/offline-warmup";
import { useConsent } from "@/providers/ConsentProvider";
import clsx from "clsx";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, loading } = useConsent();
  const showConsentBanner = !loading && status === "unknown";

  return (
    <div className="relative flex min-h-screen flex-col">
      <MainNavbar />
      {/* Standardize spacing below the navbar for all pages */}
      <main
        className={clsx(
          "container mx-auto max-w-6xl px-3 sm:px-4 pt-2 grow",
          showConsentBanner
            ? "pb-[max(10rem,env(safe-area-inset-bottom))]"
            : "pb-[max(2rem,env(safe-area-inset-bottom))]",
        )}
      >
        <OfflineBanner />
        <OfflineWarmup />
        {children}
      </main>
      <footer className="w-full flex items-center justify-center py-3 shrink-0"></footer>
    </div>
  );
}
