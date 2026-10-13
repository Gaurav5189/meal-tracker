import { Navigate, Route, Routes } from "react-router-dom";

import AuthPage from "../features/auth/AuthPage";
import { LoggedInPlaceholder } from "../features/auth/LoggedInPlaceholder";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={<LoggedInPlaceholder />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
