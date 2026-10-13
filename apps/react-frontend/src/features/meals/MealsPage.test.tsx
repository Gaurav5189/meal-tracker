import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ToastProvider } from "../../components/ToastProvider";
import { currentMonth } from "./format";
import { mealsQueryKey, type MealsMonth } from "./api";
import MealsPage from "./MealsPage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MONTH = currentMonth();
const TODAY = "2026-10-13";

const MEALS: MealsMonth = {
  month: MONTH,
  currency: "INR",
  today: TODAY,
  total: "40.00",
  taken_count: 1,
  days: [
    {
      date: "2026-10-12",
      lunch: { id: "l-12", taken: false, price: "35.00", price_overridden: false, locked: false },
      dinner: { id: "d-12", taken: false, price: "35.00", price_overridden: false, locked: false },
    },
    {
      date: TODAY,
      lunch: { id: "l-13", taken: true, price: "40.00", price_overridden: true, locked: false },
      dinner: { id: "d-13", taken: false, price: "35.00", price_overridden: false, locked: false },
    },
    {
      date: "2026-10-14",
      lunch: { id: null, taken: false, price: "35.00", price_overridden: false, locked: false },
      dinner: { id: "d-14", taken: false, price: "35.00", price_overridden: false, locked: true },
    },
  ],
};

function renderMeals(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(mealsQueryKey(MONTH), MEALS);
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MealsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function callsTo(fetchMock: ReturnType<typeof vi.fn>, method: string) {
  return (fetchMock.mock.calls as unknown as Array<[string | URL, RequestInit]>).filter(
    ([url, init]) =>
      String(url).includes(method === "PATCH" ? "/meals/" : "/meals") && init?.method === method,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("renders month card, rows, and highlights today", () => {
  renderMeals(vi.fn());

  expect(screen.getByText(/^October/)).toBeDefined();
  // Total (₹40) matches the one taken custom-price meal on today's row.
  const totalCard = screen.getByText("Meal price total").parentElement;
  expect(totalCard?.textContent).toContain("₹40");
  expect(screen.getAllByText("₹35").length).toBeGreaterThan(0);
  expect(screen.getByText("Meals taken").parentElement?.textContent).toContain("1");
  // Today's row is highlighted via the "Today" label.
  expect(screen.getByText("Today")).toBeDefined();
  // A pre-signup day renders a disabled placeholder chip.
  expect(
    screen.getByLabelText("Lunch on 14/10/26: Meals before you signed up can't be changed"),
  ).toBeDefined();
});

test("checking a skipped meal from the sheet updates the UI optimistically", async () => {
  // The PATCH never resolves: whatever renders must come from the optimistic cache.
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Promise<Response>(() => {});
    return jsonResponse(MEALS);
  });
  renderMeals(fetchMock);

  fireEvent.click(screen.getByLabelText("Dinner on 13/10/26"));
  fireEvent.click(screen.getByRole("button", { name: "Check" }));

  // Optimistic: the chip flips while the request is still pending, total updates.
  const chip = screen.getByLabelText("Dinner on 13/10/26");
  await waitFor(() => expect(chip.textContent).toContain("✓ Taken"));
  expect(screen.getByText("Meal price total").parentElement?.textContent).toContain("₹75");
  await waitFor(() => expect(callsTo(fetchMock, "PATCH")).toHaveLength(1));
  const [, init] = callsTo(fetchMock, "PATCH")[0];
  expect(JSON.parse(String(init.body))).toEqual({ taken: true });
});

test("editing the price in the sheet sends the custom price and marks it", async () => {
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Promise<Response>(() => {});
    return jsonResponse(MEALS);
  });
  renderMeals(fetchMock);

  fireEvent.click(screen.getByLabelText("Dinner on 13/10/26"));
  fireEvent.click(screen.getByRole("button", { name: "Edit price" }));
  const input = screen.getByLabelText("Meal cost") as HTMLInputElement;
  expect(input.value).toBe("35");
  fireEvent.change(input, { target: { value: "60" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(callsTo(fetchMock, "PATCH")).toHaveLength(1));
  const [, init] = callsTo(fetchMock, "PATCH")[0];
  expect(JSON.parse(String(init.body))).toEqual({ price: 60 });
  // The sheet shows the (custom) marker after saving.
  expect(screen.getByText(/Meal cost: ₹60 \(custom\)/)).toBeDefined();
});

test("resetting price with a cold settings cache fetches defaults instead of showing 0", async () => {
  const SETTINGS = {
    currency: "INR",
    lunch_price: "35",
    dinner_price: "35",
    dinner_same_as_lunch: true,
    upcoming_default_on: true,
    lock_past_meals: false,
  };
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") return new Promise<Response>(() => {});
    if (String(url).includes("/settings")) return jsonResponse(SETTINGS);
    return jsonResponse(MEALS);
  });
  renderMeals(fetchMock);

  fireEvent.click(screen.getByLabelText("Lunch on 13/10/26"));
  fireEvent.click(screen.getByRole("button", { name: "Reset to default price" }));

  // Optimistic reset uses the fetched defaults (35), never 0.
  const chip = screen.getByLabelText("Lunch on 13/10/26");
  await waitFor(() => expect(chip.textContent).toContain("₹35"));
  expect(screen.getByText("Meal price total").parentElement?.textContent).toContain("₹35");
  const settingsFetches = (
    fetchMock.mock.calls as unknown as Array<[string | URL, RequestInit?]>
  ).filter(([url]) => String(url).includes("/settings"));
  expect(settingsFetches).toHaveLength(1);
});

test("go to today appears when viewing another month and returns to the current one", async () => {
  const fetchMock = vi.fn(async () => jsonResponse(MEALS));
  renderMeals(fetchMock);

  // Current month: no pill.
  expect(screen.queryByRole("button", { name: "Go to today" })).toBeNull();

  // Navigate away: pill appears.
  fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
  const pill = await screen.findByRole("button", { name: "Go to today" });
  expect(pill).toBeDefined();

  // Clicking it returns to the current month and hides the pill.
  fireEvent.click(pill);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Go to today" })).toBeNull());
  expect(screen.getByText(/^October/)).toBeDefined();
});

test("go to today appears when the today row is scrolled out of view, arrow points to it", async () => {
  // Stub IntersectionObserver with a configurable rect; observe() reports once.
  let report: (entry: Partial<IntersectionObserverEntry>) => void = () => {};
  class FakeIO {
    constructor(cb: IntersectionObserverCallback) {
      report = (entry) =>
        cb([entry as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeIO);
  const scrollMock = vi.fn();
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scrollMock;
  try {
    renderMeals(vi.fn(async () => jsonResponse(MEALS)));

    // Today row below the viewport: pill shows with a down arrow; click scrolls to it.
    report({ isIntersecting: false, boundingClientRect: { bottom: 900 } as DOMRect });
    const pill = await screen.findByRole("button", { name: "Go to today" });
    expect(pill.textContent).toContain("↓");
    fireEvent.click(pill);
    expect(scrollMock).toHaveBeenCalledTimes(1);

    // Scrolled past it (row above the viewport): arrow flips up.
    report({ isIntersecting: false, boundingClientRect: { bottom: -40 } as DOMRect });
    await waitFor(() => expect(pill.textContent).toContain("↑"));

    // Row scrolled back into view: pill hides.
    report({ isIntersecting: true, boundingClientRect: { bottom: 300 } as DOMRect });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Go to today" })).toBeNull());
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});

test("locked chips show a toast instead of opening the sheet", async () => {
  renderMeals(vi.fn());

  fireEvent.click(screen.getByLabelText("Dinner on 14/10/26: Locked: older than 48 hours"));

  expect(await screen.findByText("Locked: older than 48 hours")).toBeDefined();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("bulk apply posts the range and reports the result", async () => {
  const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
    if (init?.method === "POST") return jsonResponse({ updated: 8, locked_skipped: 2 });
    return jsonResponse(MEALS);
  });
  renderMeals(fetchMock);

  fireEvent.click(screen.getByRole("button", { name: /Bulk actions/ }));
  fireEvent.click(screen.getByRole("button", { name: "Mark skipped" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(await screen.findByText("Updated 8 meals, 2 locked skipped")).toBeDefined();
  const posts = (fetchMock.mock.calls as unknown as Array<[string | URL, RequestInit]>).filter(
    ([, init]) => init?.method === "POST",
  );
  expect(posts).toHaveLength(1);
  const body = JSON.parse(String(posts[0][1].body));
  expect(body.taken).toBe(false);
  expect(body.meal_types).toEqual(["lunch", "dinner"]);
  expect(body.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(body.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
