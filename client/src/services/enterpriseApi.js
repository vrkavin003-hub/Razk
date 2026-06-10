import api from "./api";

export const enterpriseApi = {
  submitContact: (payload) => api.post("/contact", payload).then((response) => response.data),
  submitCareerApplication: (payload) =>
    api
      .post("/careers/apply", payload, { headers: { "Content-Type": "multipart/form-data" } })
      .then((response) => response.data),
  dashboard: () => api.get("/admin/dashboard").then((response) => response.data),
  messages: (params = {}) => api.get("/contact", { params }).then((response) => response.data),
  updateMessageStatus: (id, status) => api.patch(`/contact/${id}/status`, { status }),
  deleteMessage: (id) => api.delete(`/contact/${id}`),
  applications: (params = {}) => api.get("/careers/applications", { params }).then((response) => response.data),
  updateApplicationStatus: (id, status) => api.patch(`/careers/applications/${id}/status`, { status }),
  deleteApplication: (id) => api.delete(`/careers/applications/${id}`),
  exportReportUrl: (type, format = "pdf", params = {}) => {
    const search = new URLSearchParams({ ...params, format }).toString();
    return `${api.defaults.baseURL}/reports/${type}?${search}`;
  }
};

export default enterpriseApi;
