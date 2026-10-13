import { useState } from "react";

import styles from "./AuthPage.module.css";
import { AuthForm, type AuthMode } from "./AuthForm";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("in");

  return (
    <main className={styles.auth}>
      <div className={styles.card}>
        <h1 className={styles.brand}>Meal Tracker</h1>
        <p className={styles.tagline}>Track lunches and dinners. Know what you owe.</p>
        <div className={styles.tabs} role="tablist" aria-label="Log in or sign up">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "in"}
            className={`${styles.tab} ${mode === "in" ? styles.tabOn : ""}`}
            onClick={() => setMode("in")}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "up"}
            className={`${styles.tab} ${mode === "up" ? styles.tabOn : ""}`}
            onClick={() => setMode("up")}
          >
            Sign up
          </button>
        </div>
        <AuthForm mode={mode} />
      </div>
    </main>
  );
}
