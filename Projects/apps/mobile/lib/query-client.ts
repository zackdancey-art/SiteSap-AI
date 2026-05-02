import { QueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveApiBaseUrl } from "@/lib/api-base-url";

export const BASE_URL =
  resolveApiBaseUrl();

export async function apiRequest(method: string, path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;
  const token = await AsyncStorage.getItem("sitesnap.token");
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
