import axios from "axios";
import { API_BASE_URL, apiConfigurationWarning } from "../config/api";

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000
});

api.interceptors.request.use((config) => {
  if (apiConfigurationWarning) {
    return Promise.reject(new Error(apiConfigurationWarning));
  }

  const token = localStorage.getItem("hya_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("hya_token");
      localStorage.removeItem("hya_user");
      window.dispatchEvent(new Event("hya:auth-expired"));
    }

    const serverMessage = error.response?.data?.message;
    const validationMessage = error.response?.data?.errors?.[0]?.message;
    const fallbackMessage = error.code === "ECONNABORTED"
      ? "The server took too long to respond. Please try again."
      : error.request
        ? `Unable to reach the HYA Tech API at ${API_BASE_URL}. ${apiConfigurationWarning || "Check the backend URL and network connection."}`
        : error.message;

    return Promise.reject(new Error(serverMessage || validationMessage || fallbackMessage || "Request failed"));
  }
);

export default api;
