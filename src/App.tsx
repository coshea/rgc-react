import { Route, Routes } from "react-router-dom";

import HomePage from "@/pages/home";
import AboutPage from "@/pages/about";
import ContactPage from "@/pages/contact";

import { siteConfig } from "@/config/site";
import NotFoundPage from "@/pages/404page";
import LoginPage from "@/pages/login";
import SignUpPage from "@/pages/signup";
import PolicyPage from "./pages/policies";
import { createContext } from "react";

const UserContext = createContext(null);

function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path={siteConfig.pages.home.link} />
      <Route element={<AboutPage />} path={siteConfig.pages.about.link} />
      <Route element={<ContactPage />} path={siteConfig.pages.contact.link} />
      <Route element={<LoginPage />} path={siteConfig.pages.login.link} />
      <Route element={<SignUpPage />} path={siteConfig.pages.signup.link} />
      <Route element={<PolicyPage />} path={siteConfig.pages.policies.link} />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

export default App;
