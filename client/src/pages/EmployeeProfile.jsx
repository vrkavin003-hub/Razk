import { Eye, EyeOff, KeyRound, Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import FileUploadField from "../components/FileUploadField";
import PageHeader from "../components/PageHeader";
import UserAvatar from "../components/UserAvatar";
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
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: ""
  });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const submitPassword = async (event) => {
    event.preventDefault();
    setChangingPassword(true);
    try {
      await api.put("/auth/change-password", passwordForm);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: ""
      });
      setShowPassword(false);
      toast.success("Password changed successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setChangingPassword(false);
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
          <div className="space-y-2">
            <span className="form-label">Profile Image</span>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <UserAvatar name={form.name || user?.name} photo={form.profilePhoto} size="lg" />
              <div>
                <FileUploadField label="Upload image" onUploaded={(url) => setForm((current) => ({ ...current, profilePhoto: url }))} />
                <p className="mt-1 text-xs text-slate-500">Choose an image from this device.</p>
              </div>
            </div>
          </div>
        </div>
        <Button className="mt-5" disabled={saving} icon={Save} type="submit">
          Save Profile
        </Button>
      </form>

      <form className="panel mt-6 max-w-3xl p-5" onSubmit={submitPassword}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-50 text-slate-900 ring-1 ring-slate-200">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-950">Change Password</h3>
            <p className="text-sm text-slate-500">Update your password without exposing the existing one.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="form-label">Current Password</span>
            <input
              autoComplete="current-password"
              className="form-input"
              type={showPassword ? "text" : "password"}
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">New Password</span>
            <div className="relative">
              <input
                autoComplete="new-password"
                className="form-input pr-12"
                minLength={6}
                type={showPassword ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                required
              />
              <button
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="form-label">Confirm New Password</span>
            <input
              autoComplete="new-password"
              className="form-input"
              minLength={6}
              type={showPassword ? "text" : "password"}
              value={passwordForm.confirmNewPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmNewPassword: event.target.value }))}
              required
            />
          </label>
        </div>
        <Button className="mt-5" disabled={changingPassword} icon={Save} type="submit" variant="secondary">
          {changingPassword ? "Updating..." : "Change Password"}
        </Button>
      </form>
    </>
  );
}
