/** Fetch wrapper for the API. Errors surface as ApiError with the server envelope. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fields?: Record<string, string[]> };
}

function csrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)mt_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  const csrf = csrfToken();
  if (csrf && method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", csrf);
  }
  if (init.body != null) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      method,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "network", "Network error. Check your connection and try again.");
  }

  const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = (data ?? {}) as ErrorEnvelope;
    throw new ApiError(
      response.status,
      envelope.error?.code ?? "unknown",
      envelope.error?.message ?? `Request failed (${response.status}).`,
      envelope.error?.fields,
    );
  }
  return data as T;
}

export const apiGet = <T>(path: string) => request<T>(path);

export const apiPost = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
