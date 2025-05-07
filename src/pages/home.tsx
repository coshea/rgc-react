import { siteConfig } from "@/config/site";
import { TournamentSection } from "@/components/tournament-section";
import { NewsPage } from "@/pages/news";

export default function HomePage() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <NewsPage />
      <TournamentSection />
      {/* FAQ */}
      {/* Contact Us */}
    </section>
  );
}
