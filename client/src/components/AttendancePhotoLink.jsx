import { ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";
import Button from "./Button";

export default function AttendancePhotoLink({ attendanceId, className = "" }) {
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl]
  );

  const close = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl("");
  };

  const viewPhoto = async () => {
    if (!attendanceId || loading) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/attendance/${attendanceId}/photo`, {
        responseType: "blob",
        timeout: 30000
      });
      setPhotoUrl(URL.createObjectURL(data));
    } catch (error) {
      toast.error(error.message || "Unable to view attendance photo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100 ${className}`}
        disabled={loading}
        onClick={viewPhoto}
        type="button"
      >
        {loading ? "Opening Photo..." : "View Photo"}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </button>
      {photoUrl ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/85 p-4">
          <section className="w-full max-w-3xl rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white">Attendance Photo</h2>
                <p className="text-xs font-semibold text-slate-300">Authorized attendance evidence</p>
              </div>
              <Button icon={X} onClick={close} size="icon" variant="ghost" aria-label="Close attendance photo" />
            </div>
            <img
              alt="Watermarked attendance capture"
              className="max-h-[75vh] w-full rounded-lg bg-black object-contain"
              src={photoUrl}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}
