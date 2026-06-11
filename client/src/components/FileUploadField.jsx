import { Upload } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { uploadFile } from "../services/upload";
import Button from "./Button";

export default function FileUploadField({ accept = "image/*", label = "Upload file", onUploaded, type = "image" }) {
  const [uploading, setUploading] = useState(false);

  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, type);
      onUploaded(uploaded.url, uploaded);
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input accept={accept} className="sr-only" type="file" onChange={handleChange} disabled={uploading} />
      <Button as="span" disabled={uploading} icon={Upload} variant="secondary">
        {uploading ? "Uploading..." : label}
      </Button>
    </label>
  );
}
