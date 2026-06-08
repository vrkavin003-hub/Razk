import { useMemo, useState } from "react";
import Button from "./Button";

const departments = ["Production", "Quality", "Maintenance", "Stores", "Administration", "HR", "Finance"];
const roles = ["employee", "hr", "admin"];

export default function EmployeeForm({ initialValue, isEdit = false, onSubmit }) {
  const defaults = useMemo(
    () => ({
      employeeId: "",
      name: "",
      email: "",
      phone: "",
      department: "Production",
      designation: "",
      joiningDate: "",
      address: "",
      emergencyContact: "",
      password: "Welcome@123",
      role: "employee",
      profilePhoto: ""
    }),
    []
  );
  const [form, setForm] = useState({ ...defaults, ...initialValue });
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.password) delete payload.password;
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="panel p-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="form-label">Employee ID</span>
          <input className="form-input" value={form.employeeId || ""} onChange={update("employeeId")} required />
        </label>
        <label className="space-y-1">
          <span className="form-label">Full Name</span>
          <input className="form-input" value={form.name || ""} onChange={update("name")} required />
        </label>
        <label className="space-y-1">
          <span className="form-label">Email</span>
          <input className="form-input" type="email" value={form.email || ""} onChange={update("email")} required />
        </label>
        <label className="space-y-1">
          <span className="form-label">Phone Number</span>
          <input className="form-input" value={form.phone || ""} onChange={update("phone")} />
        </label>
        <label className="space-y-1">
          <span className="form-label">Department</span>
          <select className="form-input" value={form.department || ""} onChange={update("department")}>
            {departments.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="form-label">Designation</span>
          <input className="form-input" value={form.designation || ""} onChange={update("designation")} />
        </label>
        <label className="space-y-1">
          <span className="form-label">Joining Date</span>
          <input
            className="form-input"
            type="date"
            value={form.joiningDate ? String(form.joiningDate).slice(0, 10) : ""}
            onChange={update("joiningDate")}
          />
        </label>
        <label className="space-y-1">
          <span className="form-label">Role</span>
          <select className="form-input" value={form.role || "employee"} onChange={update("role")}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="form-label">Address</span>
          <textarea className="form-input min-h-20" value={form.address || ""} onChange={update("address")} />
        </label>
        <label className="space-y-1">
          <span className="form-label">Emergency Contact</span>
          <input className="form-input" value={form.emergencyContact || ""} onChange={update("emergencyContact")} />
        </label>
        <label className="space-y-1">
          <span className="form-label">Profile Photo URL</span>
          <input className="form-input" value={form.profilePhoto || ""} onChange={update("profilePhoto")} />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="form-label">{isEdit ? "New Password" : "Password"}</span>
          <input
            className="form-input"
            minLength={6}
            type="password"
            value={form.password || ""}
            onChange={update("password")}
            required={!isEdit}
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Employee" : "Add Employee"}
        </Button>
      </div>
    </form>
  );
}
