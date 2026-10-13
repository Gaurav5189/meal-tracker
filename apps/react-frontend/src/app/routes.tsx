import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "./AppShell";
import Skeleton from "../components/Skeleton";
import ui from "../components/ui.module.css";

const AuthPage = lazy(() => import("../features/auth/AuthPage"));
const MealsPage = lazy(() => import("../features/meals/MealsPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

function RouteFallback() {
  return (
    <div className={ui.card} aria-busy="true" aria-live="polite">
      <Skeleton width="140px" height="22px" />
      <div className={ui.skelStack}>
        <Skeleton height="48px" />
        <Skeleton height="48px" />
        <Skeleton height="48px" />
      </div>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<MealsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
