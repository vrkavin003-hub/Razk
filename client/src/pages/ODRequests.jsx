import { CheckCircle2, ExternalLink, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import DecisionDialog from "../components/DecisionDialog";
import EmptyState from "../components/EmptyState";
import FileUploadField from "../components/FileUploadField";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import RequestStatusBadge from "../components/RequestStatusBadge";
import UserAvatar from "../components/UserAvatar";
import { mediaUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate } from "../utils/formatters";
import { canDecideRequest } from "../utils/requestAccess";

const defaultForm = {
  attachment: "",
  fromTime: "",
  location: "",
  odDate: "",
  reason: "",
  toTime: ""
};

export default function ODRequests() {
  const { user } = useAuth();
  const isManager = ["admin", "hr"].includes(user?.role);
  const [requests, setRequests] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [decision, setDecision] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const endpoint = isManager ? "/od/all" : "/od/my-requests";
    const { data } = await api.get(endpoint);
    setRequests(data.requests);
  };

  useEffect(() => {
    load();
  }, [isManager]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/od/apply", form);
      setForm(defaultForm);
      toast.success("OD request submitted");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (remark) => {
    if (!decision) return;
    const { action, request } = decision;
    setDeciding(true);
    try {
      await api.put(`/od/${request._id}/${action}`, { adminRemarks: remark });
      toast.success(`OD ${action === "approve" ? "approved" : "rejected"}`);
      setDecision(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeciding(false);
    }
  };

  if (!requests) return <Loading />;

  return (
    <>
      <PageHeader
        title="OD Requests"
        description={isManager ? "Approve or reject employee on-duty requests." : "Apply on-duty work and track approval status."}
      />
      {!isManager ? (
        <form className="mb-6 panel p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="form-label">OD Date</span>
              <input
                className="form-input"
                type="date"
                value={form.odDate}
                onChange={(event) => setForm({ ...form, odDate: event.target.value })}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="form-label">Location / Client Place</span>
              <input
                className="form-input"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="form-label">From Time</span>
              <input
                className="form-input"
                type="time"
                value={form.fromTime}
                onChange={(event) => setForm({ ...form, fromTime: event.target.value })}
                required
              />
            </label>
            <label className="space-y-1">
              <span className="form-label">To Time</span>
              <input
                className="form-input"
                type="time"
                value={form.toTime}
                onChange={(event) => setForm({ ...form, toTime: event.target.value })}
                required
              />
            </label>
            <div className="space-y-2 md:col-span-2">
              <span className="form-label">Optional Image / Document</span>
              <div className="flex flex-wrap items-center gap-3">
                <FileUploadField
                  accept="image/*,.pdf,.doc,.docx"
                  label="Upload document"
                  type="document"
                  onUploaded={(url) => setForm((current) => ({ ...current, attachment: url }))}
                />
                {form.attachment ? (
                  <a className="inline-flex items-center gap-1 text-sm font-bold text-slate-900" href={mediaUrl(form.attachment)} target="_blank" rel="noreferrer">
                    View file <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
            <label className="space-y-1 md:col-span-2">
              <span className="form-label">Reason</span>
              <textarea
                className="form-input min-h-24"
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                required
              />
            </label>
          </div>
          <Button className="mt-5" disabled={saving} icon={Send} type="submit">
            Apply OD
          </Button>
        </form>
      ) : null}
      <section className="panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Attachment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Decision</th>
                {isManager ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const canDecide = canDecideRequest(request, user);
                return (
                <tr key={request._id}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={request.employee?.name || user?.name} photo={request.employee?.profilePhoto || user?.profilePhoto} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-950">{request.employee?.name || user?.name || "-"}</p>
                        <p className="text-xs text-slate-500">{request.employee?.employeeId || user?.employeeId || ""}</p>
                        <p className="text-xs text-slate-500">{request.employee?.department || user?.department || ""}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">{formatDate(request.odDate)}</td>
                  <td className="table-cell">{request.fromTime} to {request.toTime}</td>
                  <td className="table-cell max-w-xs">{request.location}</td>
                  <td className="table-cell max-w-xs">{request.reason}</td>
                  <td className="table-cell">
                    {request.attachment ? (
                      <a className="inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={mediaUrl(request.attachment)} target="_blank" rel="noreferrer">
                        View file <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="table-cell">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="table-cell">
                    {request.approvedBy?.name ? (
                      <div>
                        <p className="font-semibold text-slate-900">{request.approvedBy.name}</p>
                        <p className="text-xs text-slate-500">
                          <DateTimeDisplay value={request.decidedAt || request.updatedAt} />
                        </p>
                        {request.adminRemarks ? <p className="text-xs text-slate-500">{request.adminRemarks}</p> : null}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  {isManager ? (
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <Button
                          disabled={!canDecide}
                          icon={CheckCircle2}
                          onClick={() => setDecision({ action: "approve", request })}
                          size="sm"
                          variant="success"
                        >
                          Approve
                        </Button>
                        <Button
                          disabled={!canDecide}
                          icon={XCircle}
                          onClick={() => setDecision({ action: "reject", request })}
                          size="sm"
                          variant="danger"
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {!requests.length ? <EmptyState title="No OD requests" /> : null}
      </section>
      <DecisionDialog
        actionLabel={decision?.action === "approve" ? "Approve OD" : "Reject OD"}
        body={
          decision?.request
            ? `${decision.request.employee?.name || user?.name || "Employee"} | ${formatDate(decision.request.odDate)}`
            : ""
        }
        loading={deciding}
        onClose={() => setDecision(null)}
        onSubmit={decide}
        open={Boolean(decision)}
        title={decision?.action === "approve" ? "Approve OD Request" : "Reject OD Request"}
        variant={decision?.action === "approve" ? "success" : "danger"}
      />
    </>
  );
}
