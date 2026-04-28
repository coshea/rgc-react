import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Spinner } from "@heroui/react";
import SiteFooter from "@/components/footer";
import { siteConfig } from "@/config/site";
import RequireAuth from "@/components/require-auth";
import RequireAdmin from "@/components/require-admin";
import RequireAdminOrBoard from "@/components/require-admin-or-board";
import ProfileCompletionGate from "@/components/profile-completion-gate";

// Page-level lazy imports — each becomes its own split chunk
const HomePage = lazy(() => import("@/pages/home"));
const AboutPage = lazy(() => import("@/pages/about"));
const ContactPage = lazy(() => import("@/pages/contact"));
const TermsPage = lazy(() => import("@/pages/terms"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const NotFoundPage = lazy(() => import("@/pages/404page"));
const LoginPage = lazy(() => import("@/pages/login"));
const SignUpPage = lazy(() => import("@/pages/signup"));
const CookiePolicyPage = lazy(() => import("@/pages/cookies"));
const PastChampions = lazy(() => import("@/pages/past-champions"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const ProfileEditPage = lazy(() => import("@/pages/profile-edit"));
const UserProfilePage = lazy(() => import("@/pages/user-profile"));
const TournamentsPage = lazy(() => import("@/pages/tournaments"));
const SeasonAwardsPage = lazy(() => import("@/pages/season-awards"));
const TournamentRegister = lazy(() => import("@/pages/tournament-register"));
const TournamentDetailPage = lazy(() => import("@/pages/tournament-detail"));
const MembershipDirectoryPage = lazy(
  () => import("@/pages/membership-directory"),
);
const MembershipPage = lazy(() => import("@/pages/membership"));
const AdminDashboardPage = lazy(() => import("@/pages/admin-dashboard"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const BoardOfGovernorsPage = lazy(() => import("@/pages/board-of-governors"));
const MoneyListPage = lazy(() => import("@/pages/money-list"));
const FindAGamePage = lazy(() => import("@/pages/find-a-game"));
const BlogListPage = lazy(() =>
  import("@/pages/blog-list").then((m) => ({ default: m.BlogListPage })),
);
const BlogPostPage = lazy(() =>
  import("@/pages/blog-post").then((m) => ({ default: m.BlogPostPage })),
);
const BlogEditorPage = lazy(() =>
  import("@/pages/blog-editor").then((m) => ({ default: m.BlogEditorPage })),
);
const PolicyPage = lazy(() =>
  import("@/pages/policy").then((m) => ({ default: m.PolicyPage })),
);
const PolicyEditorPage = lazy(() =>
  import("@/pages/policy-editor").then((m) => ({
    default: m.PolicyEditorPage,
  })),
);
const PoliciesListPage = lazy(() =>
  import("@/pages/policies-list").then((m) => ({
    default: m.PoliciesListPage,
  })),
);
const AdminNotificationsPage = lazy(
  () => import("@/pages/admin-notifications"),
);
const NotificationSettingsPage = lazy(
  () => import("@/pages/notification-settings"),
);

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Spinner size="lg" />
  </div>
);

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<ProfileCompletionGate />}>
              <Route element={<HomePage />} path={siteConfig.pages.home.link} />
              <Route
                element={<AboutPage />}
                path={siteConfig.pages.about.link}
              />
              <Route
                element={<ContactPage />}
                path={siteConfig.pages.contact.link}
              />
              <Route
                element={<TermsPage />}
                path={siteConfig.pages.terms.link}
              />
              <Route
                element={<PrivacyPage />}
                path={siteConfig.pages.privacy.link}
              />
              <Route
                element={<LoginPage />}
                path={siteConfig.pages.login.link}
              />
              <Route
                element={<SignUpPage />}
                path={siteConfig.pages.signup.link}
              />
              <Route
                element={<CookiePolicyPage />}
                path={siteConfig.pages.cookies.link}
              />
              <Route
                element={<PastChampions showAllYears={true} />}
                path={siteConfig.pages.pastchampions.link}
              />
              <Route
                element={<ProfilePage />}
                path={siteConfig.pages.profile.link}
              />
              <Route element={<ProfileEditPage />} path="/profile/edit" />
              <Route
                element={
                  <RequireAuth>
                    <UserProfilePage />
                  </RequireAuth>
                }
                path="/profile/:userId"
              />
              <Route element={<TournamentsPage />} path="/tournaments" />
              <Route
                element={
                  <RequireAdmin>
                    <SeasonAwardsPage />
                  </RequireAdmin>
                }
                path="/season-awards"
              />
              <Route
                element={<TournamentDetailPage />}
                path="/tournaments/:firestoreId"
              />
              <Route
                element={<MoneyListPage />}
                path={siteConfig.pages.moneyList.link}
              />
              {/* Legacy redirect from /winnings if previously shared */}
              <Route element={<MoneyListPage />} path="/winnings" />
              <Route
                element={<TournamentRegister />}
                path="/tournaments/:firestoreId/register"
              />
              <Route element={<MembershipPage />} path="/membership" />
              <Route
                element={<MembershipDirectoryPage />}
                path="/membership/member-directory"
              />
              <Route
                element={
                  <RequireAdminOrBoard>
                    <AdminDashboardPage />
                  </RequireAdminOrBoard>
                }
                path={siteConfig.pages.adminDashboard.link}
              />
              <Route
                element={
                  <RequireAuth>
                    <BoardOfGovernorsPage />
                  </RequireAuth>
                }
                path="/board"
              />
              <Route
                element={<VerifyEmailPage />}
                path={siteConfig.pages.verifyEmail.link}
              />
              <Route
                element={
                  <RequireAuth>
                    <FindAGamePage />
                  </RequireAuth>
                }
                path={siteConfig.pages.findGame.link}
              />
              {/* Blog Routes */}
              <Route element={<BlogListPage />} path="/announcements" />
              <Route element={<BlogPostPage />} path="/announcements/:slug" />
              <Route
                element={
                  <RequireAdmin>
                    <BlogEditorPage />
                  </RequireAdmin>
                }
                path="/announcements/new"
              />
              <Route
                element={
                  <RequireAdmin>
                    <BlogEditorPage />
                  </RequireAdmin>
                }
                path="/announcements/edit/:id"
              />

              {/* Policy Routes */}
              <Route element={<PoliciesListPage />} path="/policies" />
              <Route element={<PolicyPage />} path="/policies/:type" />
              <Route
                element={
                  <RequireAdmin>
                    <PolicyEditorPage />
                  </RequireAdmin>
                }
                path="/admin/policies/:type/edit"
              />

              <Route
                element={
                  <RequireAdmin>
                    <AdminNotificationsPage />
                  </RequireAdmin>
                }
                path={siteConfig.pages.adminNotifications.link}
              />

              <Route
                element={
                  <RequireAuth>
                    <NotificationSettingsPage />
                  </RequireAuth>
                }
                path={siteConfig.pages.notificationSettings.link}
              />

              <Route element={<NotFoundPage />} path="*" />
            </Route>
          </Routes>
        </Suspense>
      </div>
      <SiteFooter />
    </div>
  );
}

export default App;
