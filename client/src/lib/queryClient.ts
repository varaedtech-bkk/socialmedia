import { QueryClient, QueryFunction } from "@tanstack/react-query";

function normalizeApiErrorMessage(status: number, rawText: string, contentType: string): string {
  const text = (rawText || "").trim();
  const looksLikeHtml =
    text.toLowerCase().includes("<!doctype") || text.toLowerCase().includes("<html");

  // Prefer JSON body when present (e.g. POST /api/login returns 401 + { error: "Invalid username or password" })
  if (contentType.includes("application/json") && text) {
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      const fromJson = parsed?.error ?? parsed?.message;
      if (typeof fromJson === "string" && fromJson.trim()) {
        return fromJson.trim();
      }
    } catch {
      /* fall through to status defaults */
    }
  }

  if (status === 401) return "Session expired. Please log in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "Requested resource was not found.";
  if (status === 413) return "Upload is too large. Please choose a smaller file.";
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status >= 500) return "Server error. Please try again in a moment.";

  if (looksLikeHtml) {
    return `Server returned an unexpected response (${status}). Please try again.`;
  }

  return text.slice(0, 180) || "Request failed. Please try again.";
}

export async function getErrorMessageFromResponse(
  res: Response,
  fallback = "Request failed. Please try again.",
): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text().catch(() => "");
  const message = normalizeApiErrorMessage(res.status, rawText, contentType);
  return message || fallback;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const message = await getErrorMessageFromResponse(res);
    throw new Error(message);
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

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  const { on401: unauthorizedBehavior } = options;
  return async ({ queryKey }) => {
    const url = queryKey[0] as string;
    
    try {
      const res = await fetch(url, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        // Silently return null for 401s when configured to do so
        return null as T;
      }

      // For other cases, throw if not ok (including 401 when behavior is "throw")
      if (!res.ok) {
        const message = await getErrorMessageFromResponse(res);
        // Create a silent error for 401s that won't be logged
        const error = new Error(message);
        if (res.status === 401) {
          // Mark 401 errors so they can be filtered out
          (error as any).is401 = true;
        }
        throw error;
      }

      return await res.json() as T;
    } catch (error: any) {
      // Re-throw but mark 401s for silent handling
      if (error.is401 || (error.message && error.message.includes("401"))) {
        error.is401 = true;
      }
      throw error;
    }
  };
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
