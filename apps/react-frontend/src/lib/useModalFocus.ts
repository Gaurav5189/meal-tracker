import { useEffect, useRef } from "react";

const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * Modal focus management (WAI-ARIA dialog pattern): moves focus into the
 * dialog on mount, keeps Tab/Shift+Tab inside it, and restores focus to the
 * trigger element when it closes. Attach the ref to the dialog container and
 * give that container tabIndex={-1} so it can hold focus itself.
 */
export function useModalFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.tabIndex !== -1,
      );

    (focusables()[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const items = focusables();
      if (items.length === 0) {
        container.focus();
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (index === -1) {
        (event.shiftKey ? items[items.length - 1] : items[0]).focus();
        return;
      }
      const next = event.shiftKey
        ? (index - 1 + items.length) % items.length
        : (index + 1) % items.length;
      items[next].focus();
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return ref;
}
