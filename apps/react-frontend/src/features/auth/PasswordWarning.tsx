import { useEffect, useRef, useState } from "react";
import styles from "./AuthPage.module.css";

/** Password label row with the "no recovery" warning icon + popover (sign up only). */
export function PasswordWarning() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.lrow} ref={wrapperRef}>
      <label className={styles.label} htmlFor="password">
        Password
      </label>
      <button
        type="button"
        className={styles.warn}
        aria-label="Password warning"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        !
      </button>
      {open && (
        <div role="tooltip" className={styles.pop}>
          Save your password. There is no reset or recovery method.
        </div>
      )}
    </div>
  );
}
