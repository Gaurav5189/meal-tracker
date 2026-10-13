import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import ui from "../components/ui.module.css";
import { ApiError } from "../lib/api";
import { fetchMe, logout, meQueryKey } from "../features/auth/api";
import OnboardingModal from "../features/onboarding/OnboardingModal";
import styles from "./AppShell.module.css";

const NAV_ITEMS = [
  { to: "/", label: "Meals", end: true },
  { to: "/profile", label: "Profile", end: false },
  { to: "/settings", label: "Settings", end: false },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/": "Meals",
  "/profile": "Profile",
  "/settings": "Settings",
};

/** Authenticated layout: sidebar (drawer on mobile), route guard, top bar. */
export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const meQuery = useQuery({ queryKey: meQueryKey, queryFn: fetchMe, retry: false });

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/auth", { replace: true });
    },
  });

  if (meQuery.isPending) {
    return (
      <div className={ui.screen}>
        <p className={`${ui.muted} ${styles.loading}`}>Loading…</p>
      </div>
    );
  }

  if (meQuery.isError) {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      return <Navigate to="/auth" replace />;
    }
    return (
      <div className={ui.screen}>
        <div className={ui.card}>
          <p className={ui.formError} role="alert">
            Something went wrong while loading your account.
          </p>
          <button className={ui.btn} type="button" onClick={() => meQuery.refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const me = meQuery.data;

  return (
    <div className={styles.app}>
      {!me.onboarded && <OnboardingModal me={me} />}
      <aside className={`${styles.sidebar} ${drawerOpen ? styles.open : ""}`}>
        <h2 className={styles.sideTitle}>Hello {me.name}</h2>
        <nav aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.sideBtn} ${isActive ? styles.sideBtnOn : ""}`}
              onClick={() => setDrawerOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.spacer} />
        <button
          className={`${styles.sideBtn} ${styles.sideBtnOut}`}
          type="button"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          Log out
        </button>
      </aside>
      <div
        className={`${styles.overlay} ${drawerOpen ? styles.overlayShow : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <main className={styles.main}>
        <div className={styles.top}>
          <button
            className={styles.burger}
            type="button"
            aria-label="Menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <h2 className={styles.pageTitle}>{PAGE_TITLES[location.pathname] ?? "Meals"}</h2>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
