import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito";
import "./styles/tokens.css";
import "./styles/index.css";
import { Providers } from "./app/providers";
import { AppRoutes } from "./app/routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
