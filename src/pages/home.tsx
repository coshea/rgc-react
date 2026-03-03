import { Skeleton } from "@heroui/react";
import { lazy, Suspense, useEffect } from "react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useLocation } from "react-router-dom";

const RecentBlogPosts = lazy(() =>
  import("@/components/recent-blog-posts").then((module) => ({
    default: module.RecentBlogPosts,
  })),
);

const TournamentSection = lazy(() =>
  import("@/components/tournament-section").then((module) => ({
    default: module.TournamentSection,
  })),
);

const PastChampions = lazy(() => import("./past-champions"));
const ContactPage = lazy(() => import("./contact"));

function BlogSectionSkeleton() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-[90vw] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton
              key={`blog-skel-${idx}`}
              className="h-64 w-full rounded-xl"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TournamentSectionSkeleton() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-[85vw] rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton
              key={`tournament-section-skel-${idx}`}
              className="h-56 w-full rounded-xl"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PastChampionsSectionSkeleton() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-[90vw] rounded-lg" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </section>
  );
}

function ContactSectionSkeleton() {
  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Skeleton className="hidden md:block h-[500px] w-full rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </section>
  );
}

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
      <Suspense fallback={<BlogSectionSkeleton />}>
        <RecentBlogPosts limit={3} />
      </Suspense>

      <Suspense fallback={<TournamentSectionSkeleton />}>
        <TournamentSection />
      </Suspense>

      <div id="home-past-champions-section" className="w-full">
        <Suspense fallback={<PastChampionsSectionSkeleton />}>
          <PastChampions showAllYears={false} />
        </Suspense>
      </div>

      <div id="home-contact-section" className="w-full">
        <Suspense fallback={<ContactSectionSkeleton />}>
          <ContactPage />
        </Suspense>
      </div>
    </section>
  );
}
