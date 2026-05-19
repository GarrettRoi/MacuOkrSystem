import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class ApiError extends Error {
  status: number;
  body: string;
  serverMessage: string;
  constructor(status: number, body: string, serverMessage: string) {
    super(`${status}: ${serverMessage || body || "Request failed"}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.serverMessage = serverMessage;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const body = (await res.text()) || res.statusText;
    let serverMessage = body;
    try {
      const parsed = JSON.parse(body);
      serverMessage = parsed?.error || parsed?.message || body;
    } catch {
      // body wasn't JSON — keep raw text
    }
    throw new ApiError(res.status, body, serverMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Pulls a user-friendly summary out of any thrown error.
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.serverMessage || err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

// Fire-and-forget. Records the failure into the activity log so admins can
// diagnose it without asking the user to reproduce.
export function logClientError(context: string, err: unknown): void {
  try {
    const message = getErrorMessage(err);
    const status = err instanceof ApiError ? err.status : null;
    const body = err instanceof ApiError ? err.body : "";
    const stack = err instanceof Error ? err.stack || "" : "";
    const detail = [
      `Context: ${context}`,
      status !== null ? `HTTP: ${status}` : null,
      body ? `Response: ${body}` : null,
      stack ? `Stack: ${stack}` : null,
    ].filter(Boolean).join("\n");
    const path = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`.slice(0, 500)
      : "";
    void fetch("/api/activity/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        path: `${path} :: ${context}`.slice(0, 500),
        errorMessage: message.slice(0, 500),
        errorDetail: detail.slice(0, 4000),
      }),
    }).catch(() => {});
  } catch {
    // Never let logging itself crash the caller.
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
