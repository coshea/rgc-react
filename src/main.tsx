import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";
import "@/styles/globals.css";
import ScrollToTop from "@/components/scroll-to-top.tsx";
import DefaultLayout from "@/layouts/default";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Provider>
        <DefaultLayout>
          <ScrollToTop />
          <App />
        </DefaultLayout>
      </Provider>
    </BrowserRouter>
  </React.StrictMode>
);
