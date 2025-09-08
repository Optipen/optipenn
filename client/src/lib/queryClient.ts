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
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  try {
    const csrf = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='))?.split('=')[1];
    if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
  } catch {}
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Fetches the current CSRF token from the server
 * This is useful when the CSRF token cookie is not available or expired
 */
export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token', {
    credentials: 'include',
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch CSRF token: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  if (!data.token) {
    throw new Error('CSRF token not found in response');
  }
  
  return data.token;
}

/**
 * Enhanced API request function that can fetch CSRF token if not available in cookies
 */
export async function apiRequestWithCsrfFallback(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Try to get CSRF token from cookie first
  let csrfToken: string | undefined;
  try {
    csrfToken = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='))?.split('=')[1];
    if (csrfToken) {
      csrfToken = decodeURIComponent(csrfToken);
    }
  } catch {}
  
  // If no CSRF token in cookie and this is a state-changing request, fetch it from server
  if (!csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    try {
      csrfToken = await fetchCsrfToken();
    } catch (error) {
      console.warn('Failed to fetch CSRF token from server:', error);
      // Continue without CSRF token - let the server handle the error
    }
  }
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T = any>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  const { on401: unauthorizedBehavior } = options;
  return async ({ queryKey }) => {
    // Build URL properly handling objects in queryKey
    let url = queryKey[0] as string;
    
    // If there are additional parameters, convert them to query string
    if (queryKey.length > 1 && queryKey[1] && typeof queryKey[1] === 'object') {
      const params = new URLSearchParams();
      const queryParams = queryKey[1] as Record<string, any>;
      
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
    }
    
    const headers: Record<string, string> = {};
    try {
      const csrf = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='))?.split('=')[1];
      if (csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    } catch {}
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null as unknown as T;
      }
      // Redirect to login on unauthorized
      try {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      } catch {}
    }

    await throwIfResNotOk(res);
    return await res.json();
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
