import { siteConfig } from "@/config/site";
import { termsSections as sections } from "@/content/policies";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function TermsPage() {
  usePageTracking("Terms of Use");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm uppercase tracking-wide text-default-500">
          {siteConfig.name}
        </p>
        <h1 className="text-3xl font-semibold">Terms of Use</h1>
        <p className="text-default-500">Last updated: January 2026</p>
      </div>
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <p className="text-default-600">{section.body}</p>
        </section>
      ))}
      <p className="text-sm text-default-500">
        Need help? Visit the Contact page or email {siteConfig.contactEmail}.
      </p>
    </div>
  );
}
