import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local dev only: same-origin /api calls are proxied to the FastAPI backend.
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
  },
});
