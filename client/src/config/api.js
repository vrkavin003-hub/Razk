import { Capacitor } from "@capacitor/core";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const isNativeMobile = () => Capacitor.isNativePlatform();

export const getApiBaseUrl = () => {
  const configuredUrl = trimTrailingSlash(import.meta.env.VITE_API_URL);
  if (configuredUrl) return configuredUrl;

  if (isNativeMobile()) {
    return import.meta.env.DEV ? "http://10.0.2.2:5000/api" : "";
  }

  if (import.meta.env.DEV) return "http://localhost:5000/api";

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (window.location.protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
  }

  return "/api";
};

export const API_BASE_URL = getApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

export const mediaUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return `${API_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
};

export const apiConfigurationWarning =
  isNativeMobile() && import.meta.env.PROD && !trimTrailingSlash(import.meta.env.VITE_API_URL)
    ? "Mobile production builds require VITE_API_URL to point to the deployed backend."
    : "";
