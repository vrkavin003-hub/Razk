import api from "./api";

export const uploadFile = async (file, type = "image") => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(`/uploads/${type}`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return data.file;
};

export const deleteUploadedFile = async (file, folder = "images") => {
  if (!file?.publicId || !file?.provider) return false;
  const { data } = await api.delete("/uploads", {
    data: {
      folder,
      provider: file.provider,
      publicId: file.publicId,
      resourceType: file.resourceType
    }
  });
  return Boolean(data.deleted);
};
