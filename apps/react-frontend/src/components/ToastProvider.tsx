import { useCallback, useRef, useState, type ReactNode } from "react";

import { Toast } from "./Toast";
import { ToastContext } from "./ToastContext";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((next: string) => {
    setMessage(next);
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 2200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Toast message={message} visible={visible} />
    </ToastContext.Provider>
  );
}
