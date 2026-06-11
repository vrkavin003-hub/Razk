import api from "./api";

export const uploadFile = async (file, type = "image") => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/uploads/${type}`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data.file;
};
