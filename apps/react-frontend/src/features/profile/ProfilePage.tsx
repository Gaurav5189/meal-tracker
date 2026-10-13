import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import ui from "../../components/ui.module.css";
import { useToast } from "../../components/ToastContext";
import { ApiError } from "../../lib/api";
import { fetchMe, meQueryKey } from "../auth/api";
import { changePassword, updateName } from "./api";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty.").max(50, "Use at most 50 characters."),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password."),
    new_password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128, "Use at most 128 characters."),
    confirm: z.string(),
  })
  .refine((values) => values.new_password === values.confirm, {
    path: ["confirm"],
    message: "Passwords don't match.",
  });

type NameValues = z.infer<typeof nameSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: meQueryKey, queryFn: fetchMe });

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: meQuery.data?.name ?? "" },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  if (meQuery.isPending || meQuery.isError) return null;
  const me = meQuery.data;

  const onNameSubmit = nameForm.handleSubmit(async (values) => {
    setNameError(null);
    try {
      const updated = await updateName({ name: values.name.trim() });
      queryClient.setQueryData(meQueryKey, updated);
      nameForm.reset({ name: updated.name });
      toast("Name saved");
    } catch (err) {
      if (err instanceof ApiError && err.fields?.name) {
        nameForm.setError("name", { type: "server", message: err.fields.name[0] });
      } else {
        setNameError(
          err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        );
      }
    }
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      passwordForm.reset();
      toast("Password updated");
    } catch (err) {
      if (err instanceof ApiError) {
        const knownFields = ["current_password", "new_password"] as const;
        let handled = false;
        for (const field of knownFields) {
          if (err.fields?.[field]) {
            passwordForm.setError(field, { type: "server", message: err.fields[field][0] });
            handled = true;
          }
        }
        if (!handled) setPasswordError(err.message);
      } else {
        setPasswordError("Something went wrong. Please try again.");
      }
    }
  });

  const fieldError = (message: string | undefined) =>
    message ? (
      <p className={ui.fieldError} role="alert">
        {message}
      </p>
    ) : null;

  return (
    <>
      <div className={ui.card}>
        <h2 className={ui.cardTitle}>Account</h2>
        <form onSubmit={onNameSubmit} noValidate>
          <label className={ui.label} htmlFor="profile-name">
            Name
          </label>
          <input
            className={ui.input}
            id="profile-name"
            type="text"
            autoComplete="name"
            aria-invalid={nameForm.formState.errors.name != null}
            {...nameForm.register("name")}
          />
          {fieldError(nameForm.formState.errors.name?.message)}
          <label className={ui.label} htmlFor="profile-username">
            Username
          </label>
          <input
            className={ui.input}
            id="profile-username"
            type="text"
            value={me.username}
            readOnly
            aria-readonly="true"
          />
          {nameError && (
            <p className={ui.formError} role="alert">
              {nameError}
            </p>
          )}
          <button className={ui.btn} type="submit" disabled={nameForm.formState.isSubmitting}>
            Save name
          </button>
        </form>
      </div>

      <div className={`${ui.card} ${ui.gap}`}>
        <h2 className={ui.cardTitle}>Reset password</h2>
        <form onSubmit={onPasswordSubmit} noValidate>
          <input
            className={ui.visuallyHidden}
            type="text"
            name="username"
            autoComplete="username"
            value={me.username}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
          />
          <label className={ui.label} htmlFor="current-password">
            Current password
          </label>
          <input
            className={ui.input}
            id="current-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={passwordForm.formState.errors.current_password != null}
            {...passwordForm.register("current_password")}
          />
          {fieldError(passwordForm.formState.errors.current_password?.message)}

          <label className={ui.label} htmlFor="new-password">
            New password
          </label>
          <input
            className={ui.input}
            id="new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={passwordForm.formState.errors.new_password != null}
            {...passwordForm.register("new_password")}
          />
          {fieldError(passwordForm.formState.errors.new_password?.message)}

          <label className={ui.label} htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            className={ui.input}
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={passwordForm.formState.errors.confirm != null}
            {...passwordForm.register("confirm")}
          />
          {fieldError(passwordForm.formState.errors.confirm?.message)}

          {passwordError && (
            <p className={ui.formError} role="alert">
              {passwordError}
            </p>
          )}
          <button className={ui.btn} type="submit" disabled={passwordForm.formState.isSubmitting}>
            Update password
          </button>
        </form>
      </div>
    </>
  );
}
