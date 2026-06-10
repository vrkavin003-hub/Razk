import { Send } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import Button from "./Button";
import enterpriseApi from "../services/enterpriseApi";

const initialForm = {
  company: "",
  email: "",
  message: "",
  name: "",
  phone: "",
  subject: ""
};

export default function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await enterpriseApi.submitContact(form);
      setForm(initialForm);
      toast.success("Message submitted successfully");
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
          <span className="form-label">Name</span>
          <input className="form-input" value={form.name} onChange={update("name")} required />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Email</span>
          <input className="form-input" type="email" value={form.email} onChange={update("email")} required />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Phone</span>
          <input className="form-input" value={form.phone} onChange={update("phone")} />
        </label>
        <label className="space-y-1.5">
          <span className="form-label">Company</span>
          <input className="form-input" value={form.company} onChange={update("company")} />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="form-label">Subject</span>
          <input className="form-input" value={form.subject} onChange={update("subject")} required />
        </label>
        <label className="space-y-1.5 md:col-span-2">
          <span className="form-label">Message</span>
          <textarea className="form-input min-h-28" value={form.message} onChange={update("message")} required />
        </label>
      </div>
      <Button className="mt-5" disabled={saving} icon={Send} type="submit">
        {saving ? "Sending..." : "Submit Message"}
      </Button>
    </form>
  );
}
