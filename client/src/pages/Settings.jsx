import { Database, KeyRound, MapPin, Save, Server, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import api, { API_BASE_URL } from "../services/api";
import { roleMatches } from "../utils/formatters";

const defaultOffice = {
  officeName: "HYA Tech",
  latitude: "12.740912",
  longitude: "77.825292",
  radiusMeters: "100",
  status: "active"
};

export default function Settings() {
  const { user } = useAuth();
  const canManageOffice = roleMatches(user?.role, ["admin"]);
  const [officeId, setOfficeId] = useState("");
  const [officeForm, setOfficeForm] = useState(defaultOffice);
  const [savingOffice, setSavingOffice] = useState(false);

  useEffect(() => {
    if (!canManageOffice) return;
    api
      .get("/office-location")
      .then(({ data }) => {
        const office = data.activeOffice || data.locations?.[0];
        if (!office) return;
        setOfficeId(office._id);
        setOfficeForm({
          officeName: office.officeName || "HYA Tech",
          latitude: String(office.latitude ?? ""),
          longitude: String(office.longitude ?? ""),
          radiusMeters: String(office.radiusMeters ?? ""),
          status: office.status || "active"
        });
      })
      .catch((error) => toast.error(error.message));
  }, [canManageOffice]);

  const updateOffice = (field) => (event) => setOfficeForm((current) => ({ ...current, [field]: event.target.value }));

  const saveOffice = async (event) => {
    event.preventDefault();
    setSavingOffice(true);
    try {
      const payload = {
        ...officeForm,
        latitude: Number(officeForm.latitude),
        longitude: Number(officeForm.longitude),
        radiusMeters: Number(officeForm.radiusMeters)
      };
      const { data } = officeId
        ? await api.put(`/office-location/${officeId}`, payload)
        : await api.post("/office-location", payload);
      setOfficeId(data.officeLocation._id);
      toast.success("Office location saved");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingOffice(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Application environment and account context." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Role" value={user?.role?.toUpperCase()} icon={Shield} tone="blue" />
        <StatCard label="Department" value={user?.department || "HYA Tech"} icon={Database} tone="slate" />
        <StatCard label="Auth" value="JWT" icon={KeyRound} tone="green" />
        <StatCard label="API" value="Online" icon={Server} tone="amber" />
      </section>
      <section className="mt-6 panel p-5">
        <h2 className="text-base font-bold text-slate-950">Runtime</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-500">API Base URL</dt>
            <dd className="mt-2 break-all text-sm font-semibold text-slate-900">{API_BASE_URL}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-500">Default Admin</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">admin@hyatech.com</dd>
          </div>
        </dl>
      </section>
      {canManageOffice ? (
        <form className="mt-6 panel p-5" onSubmit={saveOffice}>
          <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-5 dark:border-[#203e6f]">
            <span className="rounded-lg bg-hya-50 p-3 text-hya-700 ring-1 ring-hya-100">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-950 dark:text-blue-50">Office Location Settings</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-blue-200">
                Office coordinates are kept for reference. Attendance can be marked from any location.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 xl:col-span-2">
              <span className="form-label">Office Name</span>
              <input className="form-input" value={officeForm.officeName} onChange={updateOffice("officeName")} required />
            </label>
            <label className="space-y-1.5">
              <span className="form-label">Latitude</span>
              <input className="form-input" step="0.000001" type="number" value={officeForm.latitude} onChange={updateOffice("latitude")} required />
            </label>
            <label className="space-y-1.5">
              <span className="form-label">Longitude</span>
              <input className="form-input" step="0.000001" type="number" value={officeForm.longitude} onChange={updateOffice("longitude")} required />
            </label>
            <label className="space-y-1.5">
              <span className="form-label">Radius (meters)</span>
              <input className="form-input" min="1" type="number" value={officeForm.radiusMeters} onChange={updateOffice("radiusMeters")} required />
            </label>
            <label className="space-y-1.5">
              <span className="form-label">Status</span>
              <select className="form-input" value={officeForm.status} onChange={updateOffice("status")}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          <Button className="mt-5" disabled={savingOffice} icon={Save} type="submit">
            {savingOffice ? "Saving..." : "Save Office Location"}
          </Button>
        </form>
      ) : null}
    </>
  );
}
