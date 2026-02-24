import createClient from "openapi-fetch";
import type { paths } from "@/types/api";

// Server-side (SSR/Server Components): call the backend container directly.
// Client-side (browser): use relative URL so requests go through nginx.
const API_URL =
  typeof window === "undefined"
    ? (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

// Media URLs must always be browser-accessible (via nginx), never the internal backend URL.
const MEDIA_BASE =
  typeof window === "undefined"
    ? ""
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

// Helper to get full media URL
export function getMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // If already absolute URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return MEDIA_BASE ? `${MEDIA_BASE}/${cleanPath}` : `/${cleanPath}`;
}

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
