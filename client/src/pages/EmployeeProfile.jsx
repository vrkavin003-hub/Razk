import { Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function EmployeeProfile() {
  const { refreshMe, user } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    address: user?.address || "",
    emergencyContact: user?.emergencyContact || "",
    profilePhoto: user?.profilePhoto || ""
  });
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put(`/employees/${user._id}`, form);
      await refreshMe();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Employee Profile" description="Maintain your contact and emergency information." />
      <form className="panel max-w-3xl p-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="form-label">Full Name</span>
            <input className="form-input" value={form.name} onChange={update("name")} required />
          </label>
          <label className="space-y-1">
            <span className="form-label">Email</span>
            <input className="form-input bg-slate-50" value={user?.email || ""} readOnly />
          </label>
          <label className="space-y-1">
            <span className="form-label">Employee ID</span>
            <input className="form-input bg-slate-50" value={user?.employeeId || ""} readOnly />
          </label>
          <label className="space-y-1">
            <span className="form-label">Phone</span>
            <input className="form-input" value={form.phone} onChange={update("phone")} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="form-label">Address</span>
            <textarea className="form-input min-h-24" value={form.address} onChange={update("address")} />
          </label>
          <label className="space-y-1">
            <span className="form-label">Emergency Contact</span>
            <input className="form-input" value={form.emergencyContact} onChange={update("emergencyContact")} />
          </label>
          <label className="space-y-1">
            <span className="form-label">Profile Photo URL</span>
            <input className="form-input" value={form.profilePhoto} onChange={update("profilePhoto")} />
          </label>
        </div>
        <Button className="mt-5" disabled={saving} icon={Save} type="submit">
          Save Profile
        </Button>
      </form>
    </>
  );
}
