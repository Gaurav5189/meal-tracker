import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";

import styles from "./AuthPage.module.css";
import { ApiError } from "../../lib/api";
import { fetchMe, logout, meQueryKey } from "./api";

/**
 * Phase 1 placeholder proving the session works end to end (reload stays logged
 * in, log out works). Replaced by the app shell in Phase 2 and MealsPage in
 * Phase 4.
 */
export function LoggedInPlaceholder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutError, setLogoutError] = useState(false);

  const meQuery = useQuery({ queryKey: meQueryKey, queryFn: fetchMe });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      navigate("/auth", { replace: true });
    },
    onError: () => setLogoutError(true),
  });

  if (meQuery.isPending) {
    return (
      <div className={styles.auth}>
        <p className={styles.tagline}>Loading…</p>
      </div>
    );
  }

  if (meQuery.isError) {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      return <Navigate to="/auth" replace />;
    }
    return (
      <div className={styles.auth}>
        <div className={styles.card}>
          <p className={styles.formError} role="alert">
            Something went wrong while loading your account.
          </p>
          <button className={styles.btn} type="button" onClick={() => meQuery.refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const me = meQuery.data;
  return (
    <div className={styles.auth}>
      <div className={styles.card}>
        <h1 className={styles.brand}>Hello {me.name}</h1>
        <p className={styles.tagline}>
          Signed in as {me.username} ({me.tz}). The meals dashboard arrives in Phase 4.
        </p>
        {logoutError && (
          <p className={styles.formError} role="alert">
            Log out failed. Please try again.
          </p>
        )}
        <button
          className={styles.btn}
          type="button"
          onClick={() => {
            setLogoutError(false);
            logoutMutation.mutate();
          }}
          disabled={logoutMutation.isPending}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
