import { Button, Link } from "@heroui/react";
import { title } from "@/components/primitives";
import { useConsent } from "@/providers/ConsentProvider";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function CookiePolicyPage() {
  usePageTracking("Cookie Policy");
  const { status, accept, reject } = useConsent();
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10 px-4">
      <div className="w-full max-w-2xl">
        <h1 className={title()}>Cookie Policy</h1>
        <p className="text-default-500 mt-2">
          Last updated: {new Date().getFullYear()}
        </p>

        <div className="prose prose-invert max-w-none mt-6 text-foreground-600">
          <p>
            We use only essential cookies by default to run this website (for
            example, to keep you logged in and secure your session). With your
            permission, we may enable analytics cookies to help us understand
            how the site is used and improve it over time. These analytics are
            optional.
          </p>
          <h3>Types of cookies</h3>
          <ul>
            <li>
              <strong>Essential</strong> — required for core functionality like
              authentication and security. These are always on.
            </li>
            <li>
              <strong>Analytics (optional)</strong> — used to collect usage
              statistics. We only enable these if you choose “Accept”.
            </li>
          </ul>
          <h3>Who sets cookies</h3>
          <p>
            Essential cookies are set by Ridgefield Golf Club. Optional
            analytics cookies may be set by our service providers (for example,
            Google Analytics via Firebase Analytics).
          </p>
          <h3>How long we keep them</h3>
          <p>
            Essential cookies generally expire when you sign out or after a
            short period. Your analytics consent choice is stored in your
            browser until you change it.
          </p>
          <h3>Manage your preferences</h3>
          <p>You can change your choice at any time:</p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="flat"
              onPress={reject}
              isDisabled={status === "rejected"}
            >
              Reject analytics
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={accept}
              isDisabled={status === "accepted"}
            >
              Accept analytics
            </Button>
          </div>
          <p className="mt-4">
            Questions? Contact us via the <Link href="/">home page</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
