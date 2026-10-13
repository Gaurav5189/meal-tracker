import { Component, type ErrorInfo, type ReactNode } from "react";

import styles from "../components/ui.module.css";

interface State {
  error: Error | null;
}

/** Last-resort screen for render errors (Phase 2). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.cardTitle}>Something went wrong</h1>
          <p className={styles.muted}>The page crashed. Reload to start over.</p>
          <button className={styles.btn} type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
