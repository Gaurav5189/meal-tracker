/**
 * Cloudflare Pages Function: proxy /api/* to the Azure FastAPI backend.
 * Preserves method, body, cookies, and response headers (including Set-Cookie).
 */
export async function onRequest(context) {
  const { request, env } = context;

  // Azure API origin is configured in Cloudflare Pages environment variables.
  const apiOrigin = env.API_ORIGIN;
  if (!apiOrigin) {
    return new Response(
      JSON.stringify({ error: { code: "proxy_config_error", message: "API_ORIGIN is not configured." } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);
  // Preserve the full path and query string
  const targetUrl = new URL(url.pathname + url.search, apiOrigin);

  // Clone headers so we can modify them if needed
  const headers = new Headers(request.headers);

  // Build the proxy request, preserving method and body
  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: headers,
    body: request.body,
  });

  try {
    const response = await fetch(proxyRequest);

    // Rebuild the response so we can preserve headers exactly
    const responseHeaders = new Headers(response.headers);
    // Ensure Set-Cookie headers survive; Response constructor may drop some duplicates,
    // so we explicitly copy them back.
    const setCookieHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    if (setCookieHeaders.length > 0) {
      responseHeaders.delete("set-cookie");
      setCookieHeaders.forEach((value) => {
        responseHeaders.append("set-cookie", value);
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { code: "proxy_error", message: "Proxy request failed." } }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
