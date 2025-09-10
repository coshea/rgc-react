import { Route, Routes } from "react-router-dom";

import HomePage from "@/pages/home";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";

import { siteConfig } from "@/config/site";
import NotFoundPage from "@/pages/404page";
import LoginPage from "@/pages/login";
import SignUpPage from "@/pages/signup";
import PolicyPage from "@/pages/policies";
import PastChampionsWithAvatars from "@/pages/past-champions-avatars";
import ProfilePage from "@/pages/profile";
import TournamentsPage from "@/pages/tournaments";
import TournamentRegister from "@/pages/tournament-register";
import MembershipDirectoryPage from "@/pages/membership-directory";

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
        element={<PastChampionsWithAvatars showAllYears={true} />}
        path={siteConfig.pages.pastchampions.link}
      />
      <Route element={<ProfilePage />} path={siteConfig.pages.profile.link} />
      <Route element={<TournamentsPage />} path="/tournaments" />
      <Route
        element={<TournamentRegister />}
        path="/tournaments/:firestoreId/register"
      />
      <Route element={<MembershipDirectoryPage />} path="/membership" />
      <Route
        element={<MembershipDirectoryPage />}
        path="/membership/member-directory"
      />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

export default App;
