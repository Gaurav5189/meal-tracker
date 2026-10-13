import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";
import { useToast } from "../../components/ToastContext";
import { settingsQueryKey } from "../settings/api";
import {
  fetchMeals,
  mealsQueryKey,
  patchMeal,
  type Meal,
  type MealDay,
  type MealPatch,
  type MealType,
  type MealsMonth,
} from "./api";
import BulkActions from "./BulkActions";
import MealSheet from "./MealSheet";
import MealTable from "./MealTable";
import MonthCard from "./MonthCard";
import { currentMonth, todayIso } from "./format";
import styles from "./meals.module.css";
import ui from "../../components/ui.module.css";

function applyPatchToCache(
  data: MealsMonth,
  mealId: string,
  patch: MealPatch,
  defaults: { lunch: number; dinner: number },
): MealsMonth {
  return {
    ...data,
    days: data.days.map((day): MealDay => {
      const patchMealInDay = (mealType: MealType, meal: Meal): Meal => {
        if (meal.id !== mealId) return meal;
        let next = meal;
        if (patch.taken !== undefined) next = { ...next, taken: patch.taken };
        if (patch.price !== undefined) {
          next =
            patch.price === null
              ? {
                  ...next,
                  price: (mealType === "lunch" ? defaults.lunch : defaults.dinner).toFixed(2),
                  price_overridden: false,
                }
              : { ...next, price: patch.price.toFixed(2), price_overridden: true };
        }
        return next;
      };
      return { ...day, lunch: patchMealInDay("lunch", day.lunch), dinner: patchMealInDay("dinner", day.dinner) };
    }),
  };
}

/** Meals dashboard: month card, bulk actions, table, sheet (ARCHITECTURE §7). */
export default function MealsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth);
  const [sheet, setSheet] = useState<{ date: string; mealType: MealType } | null>(null);

  const mealsQuery = useQuery({ queryKey: mealsQueryKey(month), queryFn: () => fetchMeals(month) });

  const patchMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MealPatch }) => patchMeal(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: mealsQueryKey(month) });
      const previous = queryClient.getQueryData<MealsMonth>(mealsQueryKey(month));
      const settings = queryClient.getQueryData<{
        lunch_price: string;
        dinner_price: string;
        dinner_same_as_lunch: boolean;
      }>(settingsQueryKey);
      const defaults = {
        lunch: Number(settings?.lunch_price ?? 0),
        dinner: Number(
          settings?.dinner_same_as_lunch ? settings.lunch_price : settings?.dinner_price ?? 0,
        ),
      };
      if (previous) {
        queryClient.setQueryData<MealsMonth>(
          mealsQueryKey(month),
          applyPatchToCache(previous, id, patch, defaults),
        );
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(mealsQueryKey(month), context.previous);
      }
      toast(err instanceof ApiError ? err.message : "Could not update the meal. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mealsQueryKey(month) });
    },
  });

  // Totals recompute from the (optimistically patched) days so the month card
  // updates instantly; the server's own total stays the source of truth on refetch.
  const data = mealsQuery.data;
  const totals = useMemo(() => {
    if (!data) return { total: 0, takenCount: 0 };
    let total = 0;
    let takenCount = 0;
    for (const day of data.days) {
      for (const meal of [day.lunch, day.dinner]) {
        if (meal.taken) {
          total += Number(meal.price);
          takenCount += 1;
        }
      }
    }
    return { total, takenCount };
  }, [data]);

  if (mealsQuery.isPending) {
    return (
      <div className={ui.card}>
        <p className={ui.muted}>Loading…</p>
      </div>
    );
  }

  if (mealsQuery.isError || !data) {
    return (
      <div className={ui.card}>
        <p className={ui.formError} role="alert">
          Something went wrong while loading your meals.
        </p>
        <button className={ui.btn} type="button" onClick={() => mealsQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const openSheet = (day: MealDay, mealType: MealType, meal: Meal) => {
    if (meal.locked) {
      toast("Locked: older than 48 hours");
      return;
    }
    if (meal.id === null) {
      toast("Meals before you signed up can't be changed");
      return;
    }
    setSheet({ date: day.date, mealType });
  };

  // The sheet reads the meal from the live cache (not a captured snapshot) so
  // optimistic updates reflect immediately, like the demo.
  const sheetMeal = ((): Meal | null => {
    if (!sheet) return null;
    const day = data.days.find((entry) => entry.date === sheet.date);
    if (!day) return null;
    return sheet.mealType === "lunch" ? day.lunch : day.dinner;
  })();

  return (
    <>
      <MonthCard
        month={month}
        currency={data.currency}
        total={totals.total}
        takenCount={totals.takenCount}
        onMonthChange={setMonth}
      />
      <BulkActions month={month} today={data.today || todayIso()} />
      <MealTable days={data.days} today={data.today} currency={data.currency} onChipClick={openSheet} />
      {sheet && sheetMeal && (
        <MealSheet
          date={sheet.date}
          mealType={sheet.mealType}
          meal={sheetMeal}
          currency={data.currency}
          onTaken={(taken) => {
            if (sheetMeal.id) {
              patchMutation.mutate({ id: sheetMeal.id, patch: { taken } });
            }
          }}
          onPrice={(price) => {
            if (sheetMeal.id) {
              patchMutation.mutate({ id: sheetMeal.id, patch: { price } });
            }
          }}
          onClose={() => setSheet(null)}
        />
      )}
      <div className={styles.pageEnd} aria-hidden="true" />
    </>
  );
}
