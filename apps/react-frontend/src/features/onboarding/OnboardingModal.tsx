import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import ui from "../../components/ui.module.css";
import { meQueryKey, updateMe, type Me } from "../auth/api";
import SettingsForm from "../settings/SettingsForm";
import { useModalFocus } from "../../lib/useModalFocus";
import styles from "./OnboardingModal.module.css";

interface OnboardingModalProps {
  me: Me;
}

/**
 * Blocking intro popup for brand-new accounts. Shows the default settings so the
 * user can edit or just confirm them. There is deliberately no way out — no
 * close button, no backdrop click, no Escape — and the flag lives on the user
 * row, so signing out or clearing browser data doesn't skip it.
 */
export default function OnboardingModal({ me }: OnboardingModalProps) {
  const queryClient = useQueryClient();
  const dialogRef = useModalFocus<HTMLDivElement>();

  // Freeze the page behind the dialog while it's open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const confirm = async () => {
    const updated = await updateMe({ name: me.name, onboarded: true });
    queryClient.setQueryData(meQueryKey, updated);
  };

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={`${ui.card} ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
      >
        <h2 className={ui.cardTitle} id="onboarding-title">
          Welcome, {me.name}!
        </h2>
        <p className={`${ui.muted} ${styles.intro}`}>
          Here's how your tracker starts out. Adjust anything now, or just hit Continue —
          you can always change this later in Settings.
        </p>
        <SettingsForm
          submitLabel="Continue"
          successMessage="You're all set!"
          onSaved={confirm}
        />
      </div>
    </div>
  );
}
