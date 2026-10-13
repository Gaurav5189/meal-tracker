import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import ui from "../../components/ui.module.css";
import { Switch } from "../../components/Switch";
import { useToast } from "../../components/ToastContext";
import { ApiError } from "../../lib/api";
import { fetchSettings, settingsQueryKey, updateSettings } from "./api";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "BDT", "AED"] as const;

const priceSchema = z
  .number({ invalid_type_error: "Enter a price." })
  .min(0, "Price can't be negative.")
  .max(99_999_999.99, "Use a smaller amount.");

const settingsSchema = z.object({
  currency: z.enum(CURRENCIES, {
    errorMap: () => ({ message: "Choose a supported currency." }),
  }),
  lunch_price: priceSchema,
  dinner_price: priceSchema,
  dinner_same_as_lunch: z.boolean(),
  upcoming_default_on: z.boolean(),
  lock_past_meals: z.boolean(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

const toNumber = (value: string | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface SettingsFormProps {
  submitLabel: string;
  successMessage: string;
  /** Runs after a successful save (e.g. the intro popup marks onboarding done). */
  onSaved?: () => Promise<void>;
}

/** The editable settings fields. Used by SettingsPage and the intro popup. */
export default function SettingsForm({ submitLabel, successMessage, onSaved }: SettingsFormProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const settingsQuery = useQuery({ queryKey: settingsQueryKey, queryFn: fetchSettings });

  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    values: settingsQuery.data
      ? {
          currency: settingsQuery.data.currency as SettingsValues["currency"],
          lunch_price: toNumber(settingsQuery.data.lunch_price),
          dinner_price: toNumber(settingsQuery.data.dinner_price),
          dinner_same_as_lunch: settingsQuery.data.dinner_same_as_lunch,
          upcoming_default_on: settingsQuery.data.upcoming_default_on,
          lock_past_meals: settingsQuery.data.lock_past_meals,
        }
      : undefined,
  });

  const same = watch("dinner_same_as_lunch");
  const lunch = watch("lunch_price");

  // Demo's sync(): dinner mirrors lunch and is read-only while "same" is on.
  // readOnly (not disabled) keeps the registered value defined for RHF.
  useEffect(() => {
    if (same && Number.isFinite(lunch)) setValue("dinner_price", lunch);
  }, [same, lunch, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await updateSettings({
        currency: values.currency,
        lunch_price: values.lunch_price,
        dinner_price: values.dinner_same_as_lunch ? values.lunch_price : values.dinner_price,
        dinner_same_as_lunch: values.dinner_same_as_lunch,
        upcoming_default_on: values.upcoming_default_on,
        lock_past_meals: values.lock_past_meals,
      });
      queryClient.setQueryData(settingsQueryKey, saved);
      // Defaults changed: the server re-applied them to future meals (§4.2),
      // so every cached month is stale (ARCHITECTURE §7).
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      await onSaved?.();
      toast(successMessage);
    } catch (err) {
      if (err instanceof ApiError) {
        const knownFields = ["currency", "lunch_price", "dinner_price"] as const;
        let handled = false;
        for (const field of knownFields) {
          if (err.fields?.[field]) {
            setError(field, { type: "server", message: err.fields[field][0] });
            handled = true;
          }
        }
        if (!handled) setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  if (settingsQuery.isPending) {
    return (
      <div className={ui.card}>
        <p className={ui.muted}>Loading…</p>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className={ui.card}>
        <p className={ui.formError} role="alert">
          Something went wrong while loading your settings.
        </p>
        <button className={ui.btn} type="button" onClick={() => settingsQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const fieldError = (field: keyof SettingsValues) =>
    formState.errors[field] ? (
      <p className={ui.fieldError} role="alert">
        {formState.errors[field]?.message}
      </p>
    ) : null;

  return (
    <>
      <div className={ui.card}>
        <h2 className={ui.cardTitle}>Meal cost</h2>
        <form onSubmit={onSubmit} noValidate>
          <label className={ui.label} htmlFor="currency">
            Currency
          </label>
          <select
            className={ui.select}
            id="currency"
            aria-invalid={formState.errors.currency != null}
            {...register("currency")}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {fieldError("currency")}

          <label className={ui.label} htmlFor="lunch-price">
            Lunch
          </label>
          <input
            className={ui.input}
            id="lunch-price"
            type="number"
            min="0"
            step="0.01"
            aria-invalid={formState.errors.lunch_price != null}
            {...register("lunch_price", { valueAsNumber: true })}
          />
          {fieldError("lunch_price")}

          <label className={ui.label} htmlFor="dinner-price">
            Dinner
          </label>
          <input
            className={ui.input}
            id="dinner-price"
            type="number"
            min="0"
            step="0.01"
            readOnly={same}
            aria-invalid={formState.errors.dinner_price != null}
            {...register("dinner_price", { valueAsNumber: true })}
          />
          {fieldError("dinner_price")}

          <div className={ui.tog}>
            <label className={ui.label} htmlFor="same-as-lunch">
              Dinner same as lunch
            </label>
            <Switch id="same-as-lunch" {...register("dinner_same_as_lunch")} />
          </div>
        </form>
      </div>

      <div className={`${ui.card} ${ui.gap}`}>
        <h2 className={ui.cardTitle}>Upcoming meals</h2>
        <div className={ui.tog}>
          <label className={ui.label} htmlFor="upcoming-default">
            Mark as taken by default
            <span className={ui.hint}>Today and past meals are not changed.</span>
          </label>
          <Switch id="upcoming-default" {...register("upcoming_default_on")} />
        </div>
      </div>

      <div className={`${ui.card} ${ui.gap}`}>
        <h2 className={ui.cardTitle}>Past meals</h2>
        <div className={ui.tog}>
          <label className={ui.label} htmlFor="lock-past">
            Lock past meals
            <span className={ui.hint}>Meals older than 48 hours become read-only.</span>
          </label>
          <Switch id="lock-past" {...register("lock_past_meals")} />
        </div>
      </div>

      {formError && (
        <p className={ui.formError} role="alert">
          {formError}
        </p>
      )}

      <button className={ui.btn} type="button" onClick={onSubmit} disabled={formState.isSubmitting}>
        {submitLabel}
      </button>
    </>
  );
}
