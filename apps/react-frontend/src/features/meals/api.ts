import { apiGet, apiPatch, apiPost } from "../../lib/api";

export type MealType = "lunch" | "dinner";

/** Meal as the API returns it. id === null means "not materialized" (pre-signup day). */
export interface Meal {
  id: string | null;
  taken: boolean;
  price: string;
  price_overridden: boolean;
  locked: boolean;
}

export interface MealDay {
  date: string; // YYYY-MM-DD
  lunch: Meal;
  dinner: Meal;
}

export interface MealsMonth {
  month: string; // YYYY-MM as requested
  currency: string;
  today: string; // YYYY-MM-DD in the user's timezone
  total: string;
  taken_count: number;
  days: MealDay[];
}

export interface MealPatch {
  taken?: boolean;
  price?: number | null; // null resets to the default
}

export interface BulkPayload {
  from: string;
  to: string;
  meal_types: MealType[];
  taken: boolean;
}

export interface BulkResult {
  updated: number;
  locked_skipped: number;
}

export const mealsQueryKey = (month: string) => ["meals", month] as const;

export const fetchMeals = (month: string) =>
  apiGet<MealsMonth>(`/meals?month=${encodeURIComponent(month)}`);

export const patchMeal = (id: string, patch: MealPatch) =>
  apiPatch<Meal>(`/meals/${id}`, patch);

export const bulkUpdateMeals = (payload: BulkPayload) =>
  apiPost<BulkResult>("/meals/bulk", payload);
