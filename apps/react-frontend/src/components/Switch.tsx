import { forwardRef, type InputHTMLAttributes } from "react";

import styles from "./ui.module.css";

/** iOS-style toggle — demo's .sw checkbox. Spread `register()` straight onto it. */
export const Switch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Switch(props, ref) {
    return <input ref={ref} type="checkbox" className={styles.sw} {...props} />;
  },
);
