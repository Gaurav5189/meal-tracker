import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";

import { ToastProvider } from "../../components/ToastProvider";
import { meQueryKey } from "../auth/api";
import ProfilePage from "./ProfilePage";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ME = { username: "carl", name: "Carl", tz: "Asia/Kolkata" };

// staleTime: Infinity keeps the seeded /me cache fresh so mounts never refetch.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

function renderProfile(queryClient: QueryClient) {
  queryClient.setQueryData(meQueryKey, ME);
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows the editable name and read-only username", () => {
  renderProfile(makeQueryClient());

  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Carl");
  const username = screen.getByLabelText("Username") as HTMLInputElement;
  expect(username.value).toBe("carl");
  expect(username.readOnly).toBe(true);
});

test("saving the name sends PATCH /me and confirms with a toast", async () => {
  const fetchMock = vi.fn(async () => jsonResponse({ ...ME, name: "Carlita" }));
  vi.stubGlobal("fetch", fetchMock);

  renderProfile(makeQueryClient());

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Carlita" } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));

  expect(await screen.findByText("Name saved")).toBeDefined();
  const patchCall = (fetchMock.mock.calls as unknown as Array<[URL, RequestInit]>).find(
    ([, init]) => init.method === "PATCH",
  );
  const [, init] = patchCall as unknown as [URL, RequestInit];
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(String(init.body))).toEqual({ name: "Carlita" });
});

test("an empty name shows an inline error without a request", async () => {
  const fetchMock = vi.fn(async () => {
    throw new Error("unexpected fetch");
  });
  vi.stubGlobal("fetch", fetchMock);

  renderProfile(makeQueryClient());

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "Save name" }));

  expect(await screen.findByText("Name can't be empty.")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a wrong current password surfaces the server field error inline", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(
      {
        error: {
          code: "validation_error",
          message: "Check the highlighted fields.",
          fields: { current_password: ["Current password is incorrect."] },
        },
      },
      422,
    ),
  );
  vi.stubGlobal("fetch", fetchMock);

  renderProfile(makeQueryClient());

  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "wrongpass99" },
  });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnew456" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "brandnew456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));

  expect(await screen.findByText("Current password is incorrect.")).toBeDefined();
});

test("mismatched confirmation is rejected locally", async () => {
  const fetchMock = vi.fn(async () => {
    throw new Error("unexpected fetch");
  });
  vi.stubGlobal("fetch", fetchMock);

  renderProfile(makeQueryClient());

  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret123" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnew456" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "other12345" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));

  expect(await screen.findByText("Passwords don't match.")).toBeDefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a successful password change confirms with a toast", async () => {
  const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);

  renderProfile(makeQueryClient());

  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "secret123" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "brandnew456" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "brandnew456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));

  expect(await screen.findByText("Password updated")).toBeDefined();
  const postCall = (fetchMock.mock.calls as unknown as Array<[URL, RequestInit]>).find(
    ([url, init]) => String(url).includes("/me/password") && init.method === "POST",
  );
  const [, init] = postCall as unknown as [URL, RequestInit];
  expect(JSON.parse(String(init.body))).toEqual({
    current_password: "secret123",
    new_password: "brandnew456",
  });
});
