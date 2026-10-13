import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";

import AuthPage from "./AuthPage";
import { LoggedInPlaceholder } from "./LoggedInPlaceholder";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderAuthPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("shows login fields by default and reveals the name field on the Sign up tab", () => {
  renderAuthPage();

  expect(screen.queryByLabelText("Name")).toBeNull();
  expect(screen.getByLabelText("Username")).toBeDefined();
  expect(screen.getByLabelText("Password")).toBeDefined();

  fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));

  expect(screen.getByLabelText("Name")).toBeDefined();
  expect(screen.getByRole("button", { name: "Create account" })).toBeDefined();
});

test("typed values persist when switching between Log in and Sign up", () => {
  renderAuthPage();

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carl" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));

  expect((screen.getByLabelText("Username") as HTMLInputElement).value).toBe("carl");
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("secret123");
});

test("the password warning popover opens, announces itself, and closes on Escape", () => {
  renderAuthPage();
  fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));

  const warn = screen.getByRole("button", { name: "Password warning" });
  fireEvent.click(warn);

  expect(screen.getByRole("tooltip").textContent).toBe(
    "Save your password. There is no reset or recovery method.",
  );
  expect(warn.getAttribute("aria-expanded")).toBe("true");

  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("inline validation errors appear for an invalid signup", async () => {
  renderAuthPage();
  fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "no" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("Name can't be empty.")).toBeDefined();
  expect(screen.getByText("Use 3-20 characters: a-z, 0-9, underscore.")).toBeDefined();
  expect(screen.getByText("Use at least 8 characters.")).toBeDefined();
});

test("failed login shows the generic error message from the server", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      jsonResponse(
        { error: { code: "unauthenticated", message: "Invalid username or password." } },
        401,
      ),
    ),
  );
  renderAuthPage();

  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "carl" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Log in" }));

  expect(await screen.findByRole("alert")).toBeDefined();
  expect(screen.getByRole("alert").textContent).toBe("Invalid username or password.");
});

test("signup success stores the user and navigates to the placeholder home", async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/signup"))
      return jsonResponse({ username: "carl", name: "Carl", tz: "UTC" }, 201);
    if (url.includes("/me")) return jsonResponse({ username: "carl", name: "Carl", tz: "UTC" });
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/auth"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<LoggedInPlaceholder />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Sign up" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Carl" } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Carl" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("Hello Carl")).toBeDefined();

  const signupCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/auth/signup"));
  const [, init] = signupCall as unknown as [URL, RequestInit];
  expect(JSON.parse(String(init.body)).username).toBe("carl"); // lowercased like the backend
});

test("placeholder home redirects to /auth when the session is missing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      jsonResponse({ error: { code: "unauthenticated", message: "Please log in." } }, 401),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<LoggedInPlaceholder />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(screen.getByRole("tab", { name: "Log in" })).toBeDefined());
});
