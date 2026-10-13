import styles from "./Toast.module.css";

/** Sticky bottom toast — demo's #toast. Call `show("Settings saved")` from anywhere. */
export function Toast({ message, visible }: { message: string | null; visible: boolean }) {
  return (
    <div
      className={`${styles.toast} ${visible ? styles.show : ""}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
