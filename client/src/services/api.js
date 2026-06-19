import axios from "axios";
import { API_BASE_URL, apiConfigurationWarning } from "../config/api";
import { getDeviceInfo } from "../utils/device";

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

const getSessionToken = () => {
  try {
    return sessionStorage.getItem("razk_token");
  } catch {
    return null;
  }
};

const clearAuthStorage = () => {
  try {
    sessionStorage.removeItem("razk_token");
    sessionStorage.removeItem("razk_user");
    localStorage.removeItem("razk_token");
    localStorage.removeItem("razk_user");
  } catch {
    // Storage can be blocked in private modes; auth state is cleared by the context event.
  }
};

api.interceptors.request.use((config) => {
  if (apiConfigurationWarning) {
    return Promise.reject(new Error(apiConfigurationWarning));
  }

  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config.headers["X-Device-Id"] = getDeviceInfo().deviceId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearAuthStorage();
      window.dispatchEvent(new Event("razk:auth-expired"));
    }

    let serverMessage = error.response?.data?.message;
    if (!serverMessage && error.response?.data instanceof Blob) {
      try {
        const payload = JSON.parse(await error.response.data.text());
        serverMessage = payload?.message;
      } catch {
        // Non-JSON blob responses use the normal status fallback below.
      }
    }
    const validationMessage = error.response?.data?.errors?.[0]?.message;
    const statusMessage = error.response?.status
      ? `The Razk Automation API responded with ${error.response.status}.`
      : "";
    const fallbackMessage = error.code === "ECONNABORTED"
      ? "The server took too long to respond. Please try again."
      : error.response
        ? statusMessage || error.message
        : error.request
          ? `Unable to reach the Razk Automation API at ${API_BASE_URL}. ${apiConfigurationWarning || "Check the backend URL and network connection."}`
          : error.message;

    return Promise.reject(new Error(serverMessage || validationMessage || fallbackMessage || "Request failed"));
  }
);

export default api;
