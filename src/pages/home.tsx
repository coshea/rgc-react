import { TournamentSection } from "@/components/tournament-section";
import ContactPage from "./contact";
import PastChampions from "./past-champions";
import { RecentBlogPosts } from "@/components/recent-blog-posts";
import { useEffect } from "react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useLocation } from "react-router-dom";

export default function HomePage() {
  usePageTracking("Home");
  const location = useLocation();

  useEffect(() => {
    const state = location.state;
    const scrollTo =
      state && typeof state === "object" && "scrollTo" in state
        ? (state as { scrollTo?: unknown }).scrollTo
        : undefined;

    if (typeof scrollTo === "string" && scrollTo) {
      const el = document.getElementById(scrollTo);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [location]);

  return (
    <section className="flex flex-col items-center justify-center overflow-x-hidden">
      {/* Recent Blog Posts */}
      <RecentBlogPosts limit={3} />
      <TournamentSection />
      {/* Past Champions */}
      <div id="home-past-champions-section">
        <PastChampions showAllYears={false} />
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
