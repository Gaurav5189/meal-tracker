import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito";
import "./styles/tokens.css";
import "./styles/index.css";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { Providers } from "./app/providers";
import { AppRoutes } from "./app/routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Providers>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
