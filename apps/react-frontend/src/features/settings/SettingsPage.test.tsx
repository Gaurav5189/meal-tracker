import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ToastProvider } from "../../components/ToastProvider";
import { settingsQueryKey } from "./api";
import SettingsPage from "./SettingsPage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SETTINGS = {
  currency: "INR",
  lunch_price: "35.00",
  dinner_price: "35.00",
  dinner_same_as_lunch: true,
  upcoming_default_on: true,
  lock_past_meals: false,
};

function renderSettings() {
  // staleTime: Infinity keeps the seeded /settings cache fresh so mounts never refetch.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(settingsQueryKey, SETTINGS);
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SettingsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("renders the loaded settings", () => {
  renderSettings();

  expect(screen.getByLabelText("Currency")).toBeDefined();
  expect((screen.getByLabelText("Currency") as HTMLSelectElement).value).toBe("INR");
  expect((screen.getByLabelText("Lunch") as HTMLInputElement).value).toBe("35");
  expect((screen.getByLabelText("Dinner") as HTMLInputElement).value).toBe("35");
  expect((screen.getByLabelText("Dinner same as lunch") as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText(/Mark as taken by default/) as HTMLInputElement).checked).toBe(
    true,
  );
  expect((screen.getByLabelText(/Lock past meals/) as HTMLInputElement).checked).toBe(false);
});

test("dinner mirrors lunch and is disabled while 'same as lunch' is on", () => {
  renderSettings();

  const dinner = screen.getByLabelText("Dinner") as HTMLInputElement;
  expect(dinner.disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Lunch"), { target: { value: "40" } });
  expect(dinner.value).toBe("40");
});

test("unchecking 'same as lunch' enables the dinner input", () => {
  renderSettings();

  const dinner = screen.getByLabelText("Dinner") as HTMLInputElement;
  fireEvent.click(screen.getByLabelText("Dinner same as lunch"));
  expect(dinner.disabled).toBe(false);
});

test("a negative price shows an inline error and skips the request", async () => {
  const fetchMock = vi.fn(async () => {
    throw new Error("unexpected fetch");
  });
  vi.stubGlobal("fetch", fetchMock);
  renderSettings();

  fireEvent.click(screen.getByLabelText("Dinner same as lunch")); // enable dinner
  fireEvent.change(screen.getByLabelText("Dinner"), { target: { value: "-5" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByText("Price can't be negative.")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("saving sends PUT /settings and confirms with a toast", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse({
      ...SETTINGS,
      dinner_same_as_lunch: false,
      lunch_price: "40.00",
      dinner_price: "45.00",
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  renderSettings();

  fireEvent.click(screen.getByLabelText("Dinner same as lunch"));
  fireEvent.change(screen.getByLabelText("Lunch"), { target: { value: "40" } });
  fireEvent.change(screen.getByLabelText("Dinner"), { target: { value: "45" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByText("Settings saved")).toBeDefined();
  const putCall = (fetchMock.mock.calls as unknown as Array<[URL, RequestInit]>).find(
    ([, init]) => init.method === "PUT",
  );
  const [, init] = putCall as unknown as [URL, RequestInit];
  expect(init.method).toBe("PUT");
  expect(JSON.parse(String(init.body))).toEqual({
    currency: "INR",
    lunch_price: 40,
    dinner_price: 45,
    dinner_same_as_lunch: false,
    upcoming_default_on: true,
    lock_past_meals: false,
  });
});
