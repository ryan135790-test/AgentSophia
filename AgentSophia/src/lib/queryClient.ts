import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch (error) {
    console.warn('[queryClient] Failed to get auth session:', error);
  }
  return {};
};

const fetchWithTimeout = async (url: string, options?: RequestInit, timeout = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  const url = queryKey[0] as string;
  
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || "An error occurred");
    }

    return response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[QueryClient] Request timeout for ${url}`);
      throw new Error('Request timeout - server may be unavailable');
    }
    throw error;
  }
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      queryFn: defaultQueryFn,
    },
  },
});

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || "An error occurred");
    }

    return response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn(`[apiRequest] Request timeout for ${url}`);
      throw new Error('Request timeout - server may be unavailable');
    }
    throw error;
  }
}
