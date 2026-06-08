import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import DecisionDialog from "../components/DecisionDialog";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import RequestStatusBadge from "../components/RequestStatusBadge";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate } from "../utils/formatters";

const defaultForm = {
  leaveType: "Casual Leave",
  fromDate: "",
  toDate: "",
  reason: "",
  attachment: ""
};

export default function LeaveRequests() {
  const { user } = useAuth();
  const isManager = ["admin", "hr"].includes(user?.role);
  const [leaves, setLeaves] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [decision, setDecision] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const endpoint = isManager ? "/leave/all" : "/leave/my-requests";
    const { data } = await api.get(endpoint);
    setLeaves(data.leaves);
  };

  useEffect(() => {
    load();
  }, [isManager]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/leave/apply", form);
      setForm(defaultForm);
      toast.success("Leave request submitted");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (remark) => {
    if (!decision) return;
    const { action, leave } = decision;
    setDeciding(true);
    try {
      await api.put(`/leave/${leave._id}/${action}`, { adminRemarks: remark });
      toast.success(`Leave ${action === "approve" ? "approved" : "rejected"}`);
      setDecision(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeciding(false);
    }
  };

  if (!leaves) return <Loading />;

  return (
    <>
      <PageHeader
        title="Leave Requests"
        description={isManager ? "Approve or reject employee leave requests." : "Submit leave and track approval status."}
      />
      {!isManager ? (
        <form className="mb-6 panel p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="form-label">Leave Type</span>
              <select className="form-input" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                {["Casual Leave", "Sick Leave", "Emergency Leave", "Paid Leave"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="form-label">Attachment URL</span>
              <input className="form-input" value={form.attachment} onChange={(e) => setForm({ ...form, attachment: e.target.value })} />
            </label>
            <label className="space-y-1">
              <span className="form-label">From Date</span>
              <input className="form-input" type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span className="form-label">To Date</span>
              <input className="form-input" type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} required />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="form-label">Reason</span>
              <textarea className="form-input min-h-24" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </label>
          </div>
          <Button className="mt-5" disabled={saving} icon={Send} type="submit">
            Apply Leave
          </Button>
        </form>
      ) : null}
      <section className="panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">Decision</th>
                {isManager ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {leaves.map((leave) => (
                <tr key={leave._id}>
                  <td className="table-cell">
                    <p className="font-semibold text-slate-950">{leave.employee?.name || user?.name || "-"}</p>
                    <p className="text-xs text-slate-500">{leave.employee?.employeeId || user?.employeeId || ""}</p>
                    <p className="text-xs text-slate-500">{leave.employee?.department || user?.department || ""}</p>
                  </td>
                  <td className="table-cell">{leave.leaveType}</td>
                  <td className="table-cell">{formatDate(leave.fromDate)} to {formatDate(leave.toDate)}</td>
                  <td className="table-cell">
                    <DateTimeDisplay value={leave.createdAt} />
                  </td>
                  <td className="table-cell max-w-xs">{leave.reason}</td>
                  <td className="table-cell">
                    <RequestStatusBadge status={leave.status} />
                  </td>
                  <td className="table-cell">{leave.adminRemarks || "-"}</td>
                  <td className="table-cell">
                    {leave.approvedBy?.name ? (
                      <div>
                        <p className="font-semibold text-slate-900">{leave.approvedBy.name}</p>
                        <p className="text-xs text-slate-500">
                          <DateTimeDisplay value={leave.decidedAt || leave.updatedAt} />
                        </p>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  {isManager ? (
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <Button disabled={leave.status !== "Pending"} icon={CheckCircle2} onClick={() => setDecision({ action: "approve", leave })} size="sm" variant="success">
                          Approve
                        </Button>
                        <Button disabled={leave.status !== "Pending"} icon={XCircle} onClick={() => setDecision({ action: "reject", leave })} size="sm" variant="danger">
                          Reject
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!leaves.length ? <EmptyState title="No leave requests" /> : null}
      </section>
      <DecisionDialog
        actionLabel={decision?.action === "approve" ? "Approve leave" : "Reject leave"}
        body={
          decision?.leave
            ? `${decision.leave.employee?.name || user?.name || "Employee"} | ${decision.leave.leaveType} | ${formatDate(
                decision.leave.fromDate
              )} to ${formatDate(decision.leave.toDate)}`
            : ""
        }
        loading={deciding}
        onClose={() => setDecision(null)}
        onSubmit={decide}
        open={Boolean(decision)}
        title={decision?.action === "approve" ? "Approve Leave Request" : "Reject Leave Request"}
        variant={decision?.action === "approve" ? "success" : "danger"}
      />
    </>
  );
}
