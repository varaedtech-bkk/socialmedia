import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
        const text = (await res.text()) || res.statusText;
        // Create a silent error for 401s that won't be logged
        const error = new Error(`${res.status}: ${text}`);
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
