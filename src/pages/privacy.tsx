import { siteConfig } from "@/config/site";
import { privacySections as sections } from "@/content/policies";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function PrivacyPage() {
  usePageTracking("Privacy Policy");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted">
          {siteConfig.name}
        </p>
        <h1 className="text-3xl font-semibold">Privacy Policy</h1>
        <p className="text-muted">Last updated: January 2026</p>
      </div>
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <p className="text-foreground">{section.body}</p>
        </section>
      ))}
      <p className="text-sm text-muted">
        For additional club policies see {siteConfig.pages.policies.title}.
      </p>
    </div>
  );
}
