import { Send } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import Button from "./Button";
import enterpriseApi from "../services/enterpriseApi";

const initialForm = {
  cover_letter: "",
  email: "",
  experience: "",
  full_name: "",
  phone: "",
  position: "",
  qualification: "",
  resume: null
};

export default function CareerApplicationForm() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) payload.append(key, value);
      });
      await enterpriseApi.submitCareerApplication(payload);
      setForm(initialForm);
      event.target.reset();
      toast.success("Application submitted successfully");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="panel p-5" onSubmit={submit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="form-label">Full Name</span>
          <input className="form-input" value={form.full_name} onChange={update("full_name")} required />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Email</span>
          <input className="form-input" type="email" value={form.email} onChange={update("email")} required />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Phone</span>
          <input className="form-input" value={form.phone} onChange={update("phone")} required />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Position</span>
          <input className="form-input" value={form.position} onChange={update("position")} required />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Experience</span>
          <input className="form-input" min="0" step="0.5" type="number" value={form.experience} onChange={update("experience")} />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Qualification</span>
          <input className="form-input" value={form.qualification} onChange={update("qualification")} required />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="form-label">Resume</span>
          <input
            accept=".pdf,.doc,.docx"
            className="form-input"
            onChange={(event) => setForm((current) => ({ ...current, resume: event.target.files?.[0] || null }))}
            type="file"
            required
          />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="form-label">Cover Letter</span>
          <textarea className="form-input min-h-28" value={form.cover_letter} onChange={update("cover_letter")} />
        </label>
      </div>
      <Button className="mt-5" disabled={saving} icon={Send} type="submit">
        {saving ? "Submitting..." : "Submit Application"}
      </Button>
    </form>
  );
}
