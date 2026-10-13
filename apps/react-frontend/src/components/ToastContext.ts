import { createContext, useContext } from "react";

/** Context + hook kept in a component-free module so fast refresh stays happy. */
export const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}
