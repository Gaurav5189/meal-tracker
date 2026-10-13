import { apiGet, apiPut } from "../../lib/api";

export interface Settings {
  currency: string;
  lunch_price: string;
  dinner_price: string;
  dinner_same_as_lunch: boolean;
  upcoming_default_on: boolean;
  lock_past_meals: boolean;
}

export type SettingsPayload = Omit<Settings, "lunch_price" | "dinner_price"> & {
  lunch_price: number;
  dinner_price: number;
};

export const settingsQueryKey = ["settings"] as const;

export const fetchSettings = () => apiGet<Settings>("/settings");

export const updateSettings = (payload: SettingsPayload) => apiPut<Settings>("/settings", payload);
