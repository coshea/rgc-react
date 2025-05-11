import { TournamentSection } from "@/components/tournament-section";
import { NewsPage } from "@/pages/news";
import ContactPage from "./contact";
import PastChampionsWithAvatars from "./past-champions-avatars";

export default function HomePage() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <NewsPage />
      <TournamentSection />
      {/* Past Champions */}
      <div id="home-past-champions-section">
        <PastChampionsWithAvatars showAllYears={false} />
      </div>
      {/* FAQ */}
      {/* Contact Us */}
      <div id="home-contact-section">
        <ContactPage />
      </div>
      {/* External Link Cards, maybe just in footer?*/}
      {/* Footer */}
    </section>
  );
}
