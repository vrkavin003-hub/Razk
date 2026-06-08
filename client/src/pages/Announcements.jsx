import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AnnouncementCard from "../components/AnnouncementCard";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const defaultForm = {
  title: "",
  message: "",
  targetRole: "all"
};

export default function Announcements() {
  const { user } = useAuth();
  const isManager = ["admin", "hr"].includes(user?.role);
  const [announcements, setAnnouncements] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get("/announcements");
    setAnnouncements(data.announcements);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/announcements", form);
      setForm(defaultForm);
      toast.success("Announcement published");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!announcements) return <Loading />;

  return (
    <>
      <PageHeader title="Announcements" description="Company notices for employees, HR, and administrators." />
      {isManager ? (
        <form className="mb-6 panel p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <label className="space-y-1">
              <span className="form-label">Title</span>
              <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span className="form-label">Target Role</span>
              <select className="form-input" value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}>
                {["all", "employee", "hr", "admin"].map((role) => (
                  <option key={role} value={role}>
                    {role.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="form-label">Message</span>
              <textarea className="form-input min-h-24" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            </label>
          </div>
          <Button className="mt-5" disabled={saving} icon={Send} type="submit">
            Publish
          </Button>
        </form>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-2">
        {announcements.map((announcement) => (
          <AnnouncementCard announcement={announcement} key={announcement._id} />
        ))}
      </section>
      {!announcements.length ? <EmptyState title="No announcements" /> : null}
    </>
  );
}
