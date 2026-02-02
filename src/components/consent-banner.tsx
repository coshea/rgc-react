import { Button, Link, Chip } from "@heroui/react";
import { useConsent } from "@/providers/ConsentProvider";
import { siteConfig } from "@/config/site";

export default function ConsentBanner() {
  const { status, loading, accept, reject } = useConsent();
  if (loading) return null;
  if (status !== "unknown") return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 px-4 pb-4"
      style={{ zIndex: 10000 }}
    >
      <div className="mx-auto max-w-3xl rounded-large border border-default-200/60 dark:border-default-100/10 bg-background/95 backdrop-blur p-4 shadow-large flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 text-sm text-foreground-600">
          <div className="flex items-center gap-2 mb-1">
            <Chip color="primary" variant="flat" size="sm">
              Privacy
            </Chip>
            <span className="font-medium text-foreground">Cookies</span>
          </div>
          We use only essential cookies by default. With your permission, we’ll
          enable analytics to help improve the site. You can read our{" "}
          <Link href={siteConfig.pages.cookies.link} color="primary">
            Cookie Policy
          </Link>
          .
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="flat" onPress={reject} color="default">
            Reject
          </Button>
          <Button variant="solid" color="primary" onPress={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
