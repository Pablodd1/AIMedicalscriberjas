import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Token storage key
const TOKEN_KEY = 'aims_auth_token';

// Get stored token
export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

// Store token
export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

// Remove token
export function removeAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

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
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add JWT token to Authorization header if available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Keep for backwards compatibility
  });

  // Don't throw for login/register - let the mutation handle errors
  if (url === '/api/login' || url === '/api/register') {
    return res;
  }

  await throwIfResNotOk(res);
  
  // Handle structured response format for mutations
  const result = await res.json();
  if (result && typeof result === 'object' && 'success' in result) {
    if (!result.success) {
      throw new Error(result.error || 'Request failed');
    }
    // Return the original response but with the data in the body
    return new Response(JSON.stringify(result.data), {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers
    });
  }
  
  // Return original response for legacy format
  return new Response(JSON.stringify(result), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    
    // Add JWT token to Authorization header if available
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include", // Keep for backwards compatibility
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const result = await res.json();
    
    // Handle new structured response format
    if (result && typeof result === 'object' && 'success' in result) {
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Request failed');
      }
    }
    
    // Fallback for legacy responses
    return result;
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
