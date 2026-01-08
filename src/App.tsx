import { Route, Routes } from "react-router-dom";
import SiteFooter from "@/components/footer";

import HomePage from "@/pages/home";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";

import { siteConfig } from "@/config/site";
import NotFoundPage from "@/pages/404page";
import LoginPage from "@/pages/login";
import SignUpPage from "@/pages/signup";
import CookiePolicyPage from "@/pages/cookies";
import PastChampions from "@/pages/past-champions";
import ProfilePage from "@/pages/profile";
import UserProfilePage from "@/pages/user-profile";
import TournamentsPage from "@/pages/tournaments";
import TournamentRegister from "@/pages/tournament-register";
import TournamentDetailPage from "@/pages/tournament-detail";
import MembershipDirectoryPage from "@/pages/membership-directory";
import MembershipPage from "@/pages/membership";
import VerifyEmailPage from "@/pages/verify-email";
import BoardOfGovernorsPage from "@/pages/board-of-governors";
import MoneyListPage from "@/pages/money-list";
import FindAGamePage from "@/pages/find-a-game";
import { BlogListPage } from "@/pages/blog-list";
import { BlogPostPage } from "@/pages/blog-post";
import { BlogEditorPage } from "@/pages/blog-editor";
import { PolicyPage } from "@/pages/policy";
import { PolicyEditorPage } from "@/pages/policy-editor";
import { PoliciesListPage } from "@/pages/policies-list";
import RequireAuth from "@/components/require-auth";
import RequireAdmin from "@/components/require-admin";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Routes>
          <Route element={<HomePage />} path={siteConfig.pages.home.link} />
          <Route element={<AboutPage />} path={siteConfig.pages.about.link} />
          <Route
            element={<ContactPage />}
            path={siteConfig.pages.contact.link}
          />
          <Route element={<TermsPage />} path={siteConfig.pages.terms.link} />
          <Route
            element={<PrivacyPage />}
            path={siteConfig.pages.privacy.link}
          />
          <Route element={<LoginPage />} path={siteConfig.pages.login.link} />
          <Route element={<SignUpPage />} path={siteConfig.pages.signup.link} />
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
          <Route element={<BoardOfGovernorsPage />} path="/board" />
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

          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </div>
      <SiteFooter />
    </div>
  );
}

export default App;
