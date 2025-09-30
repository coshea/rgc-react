import { Route, Routes } from "react-router-dom";

import HomePage from "@/pages/home";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";

import { siteConfig } from "@/config/site";
import NotFoundPage from "@/pages/404page";
import LoginPage from "@/pages/login";
import SignUpPage from "@/pages/signup";
import PolicyPage from "@/pages/policies";
import PastChampions from "@/pages/past-champions";
import ProfilePage from "@/pages/profile";
import TournamentsPage from "@/pages/tournaments";
import TournamentRegister from "@/pages/tournament-register";
import TournamentDetailPage from "@/pages/tournament-detail";
import MembershipDirectoryPage from "@/pages/membership-directory";
import MembershipPage from "@/pages/membership";
import VerifyEmailPage from "@/pages/verify-email";
import BoardOfGovernorsPage from "@/pages/board-of-governors";
import MoneyListPage from "@/pages/money-list";
import FindAGamePage from "@/pages/find-a-game";
import RequireAuth from "@/components/require-auth";

function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path={siteConfig.pages.home.link} />
      <Route element={<AboutPage />} path={siteConfig.pages.about.link} />
      <Route element={<ContactPage />} path={siteConfig.pages.contact.link} />
      <Route element={<LoginPage />} path={siteConfig.pages.login.link} />
      <Route element={<SignUpPage />} path={siteConfig.pages.signup.link} />
      <Route element={<PolicyPage />} path={siteConfig.pages.policies.link} />
      <Route
        element={<PastChampions showAllYears={true} />}
        path={siteConfig.pages.pastchampions.link}
      />
      <Route element={<ProfilePage />} path={siteConfig.pages.profile.link} />
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
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

export default App;
