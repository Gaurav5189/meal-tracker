import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "../../lib/api";
import { useToast } from "../../components/ToastContext";
import { settingsQueryKey, fetchSettings, type Settings } from "../settings/api";
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
      return {
        ...day,
        lunch: patchMealInDay("lunch", day.lunch),
        dinner: patchMealInDay("dinner", day.dinner),
      };
    }),
  };
}

/** True when the user asked the OS to reduce motion; guarded for jsdom/old browsers. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
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
      // The settings cache is only filled after SettingsPage has been opened.
      // A price reset needs real defaults: fetch them rather than showing 0.
      let settings = queryClient.getQueryData<Settings>(settingsQueryKey);
      if (previous && patch.price === null && !settings) {
        try {
          settings = await queryClient.fetchQuery({
            queryKey: settingsQueryKey,
            queryFn: fetchSettings,
          });
        } catch {
          // No defaults available: skip only the price patch (the taken change
          // still applies optimistically); the onSettled refetch corrects price.
        }
      }
      const cachePatch: MealPatch =
        patch.price === null && !settings ? { taken: patch.taken } : patch;
      const defaults = {
        lunch: Number(settings?.lunch_price ?? 0),
        dinner: Number(
          settings?.dinner_same_as_lunch ? settings.lunch_price : (settings?.dinner_price ?? 0),
        ),
      };
      if (previous) {
        queryClient.setQueryData<MealsMonth>(
          mealsQueryKey(month),
          applyPatchToCache(previous, id, cachePatch, defaults),
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

  const data = mealsQuery.data;

  // --- "Go to today" pill (hooks must live above the early returns) -------
  // Shows whenever today's row is not on screen: either the user is viewing
  // another month, or they scrolled the current month so the today row left
  // the viewport (below or above). Clicking it scrolls the row into view.
  const todayRowRef = useRef<HTMLDivElement | null>(null);
  const scrollPending = useRef(false);
  const [todayVisible, setTodayVisible] = useState(true);
  // Arrow points toward the row: above the viewport (scrolled past) → ↑.
  const [todayAbove, setTodayAbove] = useState(false);

  const setTodayRow = useCallback((el: HTMLDivElement | null) => {
    todayRowRef.current = el;
    // A jump from another month: scroll as soon as the row mounts.
    if (el && scrollPending.current) {
      scrollPending.current = false;
      el.scrollIntoView?.({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    }
  }, []);

  useEffect(() => {
    const el = todayRowRef.current;
    // jsdom (tests) and very old browsers have no IntersectionObserver; then
    // the pill only reacts to the viewed month, which stays correct.
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        setTodayVisible(entries[0].isIntersecting);
        setTodayAbove(entries[0].boundingClientRect.bottom < 0);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [data, month]);

  // Totals recompute from the (optimistically patched) days so the month card
  // updates instantly; the server's own total stays the source of truth on refetch.
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
    // Surface the server's reason (e.g. a month past the materialization
    // horizon) instead of a generic dead-end.
    const reason =
      mealsQuery.error instanceof ApiError
        ? (mealsQuery.error.fields?.month?.[0] ?? mealsQuery.error.message)
        : null;
    return (
      <div className={ui.card}>
        <p className={ui.formError} role="alert">
          {reason ?? "Something went wrong while loading your meals."}
        </p>
        <button className={ui.btn} type="button" onClick={() => mealsQuery.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  // "Go to today" target follows the server's user-timezone date, not the
  // device clock, so it stays consistent with the today row highlight.
  const todayMonth = (data.today || todayIso()).slice(0, 7);

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

  const goToToday = () => {
    if (month !== todayMonth) {
      // Switch month first; setTodayRow scrolls once the row mounts.
      scrollPending.current = true;
      setMonth(todayMonth);
      return;
    }
    todayRowRef.current?.scrollIntoView?.({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
  };

  const showGoToday = month !== todayMonth || !todayVisible;

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
      <MealTable
        days={data.days}
        today={data.today}
        currency={data.currency}
        onChipClick={openSheet}
        todayRowRef={setTodayRow}
      />
      {showGoToday && (
        <button type="button" className={styles.goToday} onClick={goToToday}>
          Go to today <span aria-hidden="true">{todayAbove ? "↑" : "↓"}</span>
        </button>
      )}
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
