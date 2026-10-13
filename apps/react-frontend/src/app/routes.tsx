import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./AppShell";
import AuthPage from "../features/auth/AuthPage";
import MealsPage from "../features/meals/MealsPage";
import ProfilePage from "../features/profile/ProfilePage";
import SettingsPage from "../features/settings/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<MealsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
