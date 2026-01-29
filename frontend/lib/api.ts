import createClient from "openapi-fetch";
import type { paths } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = createClient<paths>({
  baseUrl: API_URL,
});

// Helper to set auth token
export function setAuthToken(token: string) {
  apiClient.use({
    onRequest({ request }) {
      request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });
}

// Helper to clear auth token
export function clearAuthToken() {
  // Create a new client instance without auth
  const newClient = createClient<paths>({
    baseUrl: API_URL,
  });
  Object.assign(apiClient, newClient);
}

// Auth helpers
export const auth = {
  getToken: () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("auth_token");
    }
    return null;
  },
  
  setToken: (token: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
      setAuthToken(token);
    }
  },
  
  clearToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      clearAuthToken();
    }
  },
  
  isAuthenticated: () => {
    return !!auth.getToken();
  },
};

// Initialize auth token if exists
if (typeof window !== "undefined") {
  const token = auth.getToken();
  if (token) {
    setAuthToken(token);
  }
}
