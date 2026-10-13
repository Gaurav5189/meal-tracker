import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "./App";

test("renders the Meal Tracker title", () => {
  render(<App />);
  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading.textContent).toBe("Meal Tracker");
});
