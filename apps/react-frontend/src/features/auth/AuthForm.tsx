import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import styles from "./AuthPage.module.css";
import { ApiError } from "../../lib/api";
import { browserTimezone } from "../../lib/tz";
import { login, meQueryKey, signup } from "./api";
import { PasswordWarning } from "./PasswordWarning";

export type AuthMode = "in" | "up";

interface AuthFormValues {
  name: string;
  username: string;
  password: string;
}

const usernameSchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{3,20}$/, "Use 3-20 characters: a-z, 0-9, underscore."));

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.");

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty.").max(50, "Use at most 50 characters."),
  username: usernameSchema,
  password: passwordSchema,
});

// In login mode `name` is neither rendered nor sent; it stays loose so one form
// type covers both modes and typed values persist across tab switches (like the demo).
const loginSchema = z.object({
  name: z.string(),
  username: usernameSchema,
  password: passwordSchema,
});

export function AuthForm({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  // The resolver is captured once by react-hook-form, so the active schema is
  // read through a ref to keep validation in sync with the selected tab.
  const schemaRef = useRef<z.ZodType<AuthFormValues>>(loginSchema);
  useEffect(() => {
    schemaRef.current = mode === "up" ? signupSchema : loginSchema;
  }, [mode]);

  const resolver = useCallback<Resolver<AuthFormValues>>(
    (values, context, options) => zodResolver(schemaRef.current)(values, context, options),
    [],
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({
    resolver,
    defaultValues: { name: "", username: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const tz = browserTimezone();
    try {
      const me =
        mode === "up"
          ? await signup({
              name: values.name.trim(),
              username: values.username,
              password: values.password,
              tz,
            })
          : await login({ username: values.username, password: values.password, tz });
      queryClient.setQueryData(meQueryKey, me);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const knownFields = new Set(["username", "password", ...(mode === "up" ? ["name"] : [])]);
        let fieldHandled = false;
        for (const [field, messages] of Object.entries(err.fields ?? {})) {
          if (knownFields.has(field)) {
            setError(field as "name" | "username" | "password", {
              type: "server",
              message: messages[0],
            });
            fieldHandled = true;
          }
        }
        if (!fieldHandled) setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  const fieldError = (field: "name" | "username" | "password") =>
    errors[field] ? (
      <p id={`${field}-error`} className={styles.fieldError} role="alert">
        {errors[field]?.message}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      {mode === "up" && (
        <div>
          <label className={styles.label} htmlFor="name">
            Name
          </label>
          <input
            className={styles.input}
            id="name"
            type="text"
            autoComplete="name"
            aria-invalid={errors.name != null}
            aria-describedby={errors.name != null ? "name-error" : undefined}
            {...register("name")}
          />
          {fieldError("name")}
        </div>
      )}

      <label className={styles.label} htmlFor="username">
        Username
      </label>
      <input
        className={styles.input}
        id="username"
        type="text"
        autoComplete="username"
        aria-invalid={errors.username != null}
        aria-describedby={errors.username != null ? "username-error" : undefined}
        {...register("username")}
      />
      {fieldError("username")}

      {mode === "up" ? (
        <PasswordWarning />
      ) : (
        <label className={styles.label} htmlFor="password">
          Password
        </label>
      )}
      <input
        className={styles.input}
        id="password"
        type="password"
        autoComplete={mode === "up" ? "new-password" : "current-password"}
        aria-invalid={errors.password != null}
        aria-describedby={errors.password != null ? "password-error" : undefined}
        {...register("password")}
      />
      {fieldError("password")}

      {formError && (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      )}

      <button className={styles.btn} type="submit" disabled={isSubmitting}>
        {mode === "up" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
