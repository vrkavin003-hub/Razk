import { Edit3, Filter, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import EmptyState from "../components/EmptyState";
import FileUploadField from "../components/FileUploadField";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import UserAvatar from "../components/UserAvatar";
import api from "../services/api";
import { formatDate } from "../utils/formatters";

const defaultForm = {
  checkInTime: "",
  checkOutTime: "",
  companyName: "",
  mobileNumber: "",
  personToMeet: "",
  purposeOfVisit: "",
  remarks: "",
  visitDate: "",
  visitorImage: "",
  visitorName: ""
};

const dateInputValue = (value) => (value ? String(value).slice(0, 10) : "");
const timeInputValue = (value) => (value ? String(value).slice(11, 16) : "");

const buildPayload = (form) => ({
  ...form,
  checkInTime: form.checkInTime && form.visitDate ? `${form.visitDate}T${form.checkInTime}:00` : null,
  checkOutTime: form.checkOutTime && form.visitDate ? `${form.visitDate}T${form.checkOutTime}:00` : null
});

export default function VisitorVisits() {
  const [visitors, setVisitors] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const params = filterDate ? { date: filterDate } : {};
    const { data } = await api.get("/visitors", { params });
    setVisitors(data.visitors);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId("");
    setForm(defaultForm);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editingId) {
        await api.put(`/visitors/${editingId}`, payload);
        toast.success("Visitor record updated");
      } else {
        await api.post("/visitors", payload);
        toast.success("Visitor record added");
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (visitor) => {
    setEditingId(visitor._id);
    setForm({
      checkInTime: timeInputValue(visitor.checkInTime),
      checkOutTime: timeInputValue(visitor.checkOutTime),
      companyName: visitor.companyName || "",
      mobileNumber: visitor.mobileNumber || "",
      personToMeet: visitor.personToMeet || "",
      purposeOfVisit: visitor.purposeOfVisit || "",
      remarks: visitor.remarks || "",
      visitDate: dateInputValue(visitor.visitDate),
      visitorImage: visitor.visitorImage || "",
      visitorName: visitor.visitorName || ""
    });
  };

  const removeVisitor = async (visitor) => {
    if (!window.confirm(`Delete visitor record for ${visitor.visitorName}?`)) return;
    try {
      await api.delete(`/visitors/${visitor._id}`);
      toast.success("Visitor record deleted");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!visitors) return <Loading />;

  return (
    <>
      <PageHeader
        title="Customer / Visitor Visits"
        description="Maintain customer and non-employee visit records."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              className="form-input min-h-11 w-40"
              type="date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
            />
            <Button icon={Filter} onClick={load} variant="secondary">
              Filter
            </Button>
          </div>
        }
      />
      <form className="mb-6 panel p-5" onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-[#203e6f]">
          <div>
            <h2 className="text-base font-black text-slate-950 dark:text-blue-50">
              {editingId ? "Edit Visitor" : "Add Visitor"}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-blue-200">Capture visitor details and optional photo.</p>
          </div>
          {editingId ? (
            <Button icon={X} onClick={resetForm} type="button" variant="secondary">
              Cancel
            </Button>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-1">
            <span className="form-label">Visitor Name</span>
            <input
              className="form-input"
              value={form.visitorName}
              onChange={(event) => setForm({ ...form, visitorName: event.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Mobile Number</span>
            <input
              className="form-input"
              value={form.mobileNumber}
              onChange={(event) => setForm({ ...form, mobileNumber: event.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Company Name</span>
            <input
              className="form-input"
              value={form.companyName}
              onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Purpose of Visit</span>
            <input
              className="form-input"
              value={form.purposeOfVisit}
              onChange={(event) => setForm({ ...form, purposeOfVisit: event.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Person to Meet</span>
            <input
              className="form-input"
              value={form.personToMeet}
              onChange={(event) => setForm({ ...form, personToMeet: event.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Visit Date</span>
            <input
              className="form-input"
              type="date"
              value={form.visitDate}
              onChange={(event) => setForm({ ...form, visitDate: event.target.value })}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Check-In Time</span>
            <input
              className="form-input"
              type="time"
              value={form.checkInTime}
              onChange={(event) => setForm({ ...form, checkInTime: event.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span className="form-label">Check-Out Time</span>
            <input
              className="form-input"
              type="time"
              value={form.checkOutTime}
              onChange={(event) => setForm({ ...form, checkOutTime: event.target.value })}
            />
          </label>
          <div className="space-y-2">
            <span className="form-label">Visitor Image</span>
            <div className="flex items-center gap-3">
              <UserAvatar name={form.visitorName} photo={form.visitorImage} />
              <FileUploadField
                label="Upload image"
                onUploaded={(url) => setForm((current) => ({ ...current, visitorImage: url }))}
              />
            </div>
          </div>
          <label className="space-y-1 md:col-span-2 xl:col-span-3">
            <span className="form-label">Remarks</span>
            <textarea
              className="form-input min-h-20"
              value={form.remarks}
              onChange={(event) => setForm({ ...form, remarks: event.target.value })}
            />
          </label>
        </div>
        <Button className="mt-5" disabled={saving} icon={editingId ? Save : Plus} type="submit">
          {editingId ? "Save Visitor" : "Add Visitor"}
        </Button>
      </form>
      <section className="panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Visitor</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Person to Meet</th>
                <th className="px-4 py-3">Visit Date</th>
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor._id}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={visitor.visitorName} photo={visitor.visitorImage} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-950">{visitor.visitorName}</p>
                        <p className="text-xs text-slate-500">{visitor.mobileNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">{visitor.companyName || "-"}</td>
                  <td className="table-cell max-w-xs">{visitor.purposeOfVisit}</td>
                  <td className="table-cell">{visitor.personToMeet}</td>
                  <td className="table-cell">{formatDate(visitor.visitDate)}</td>
                  <td className="table-cell">
                    <DateTimeDisplay value={visitor.checkInTime} />
                  </td>
                  <td className="table-cell">
                    <DateTimeDisplay value={visitor.checkOutTime} />
                  </td>
                  <td className="table-cell max-w-xs">{visitor.remarks || "-"}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <Button icon={Edit3} onClick={() => startEdit(visitor)} size="sm" variant="secondary">
                        Edit
                      </Button>
                      <Button icon={Trash2} onClick={() => removeVisitor(visitor)} size="sm" variant="danger">
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visitors.length ? <EmptyState title="No visitor records" /> : null}
      </section>
    </>
  );
}
