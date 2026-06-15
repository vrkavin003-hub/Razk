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
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate } from "../utils/formatters";
import { canDecideRequest } from "../utils/requestAccess";

const defaultForm = {
  permissionType: "Late Coming",
  date: "",
  fromTime: "",
  toTime: "",
  reason: ""
};

export default function PermissionRequests() {
  const { user } = useAuth();
  const isManager = ["admin", "hr"].includes(user?.role);
  const [permissions, setPermissions] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [balance, setBalance] = useState(null);
  const [balances, setBalances] = useState({});
  const [decision, setDecision] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const endpoint = isManager ? "/permission/all" : "/permission/my-requests";
    const { data } = await api.get(endpoint);
    setPermissions(data.permissions);
    setBalance(data.balance || null);
    setBalances(data.balances || {});
  };

  useEffect(() => {
    load();
  }, [isManager]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/permission/apply", form);
      setForm(defaultForm);
      toast.success("Permission request submitted");
      if (data.warning) toast.error(data.warning);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const decide = async (remark) => {
    if (!decision) return;
    const { action, permission } = decision;
    setDeciding(true);
    try {
      const { data } = await api.put(`/permission/${permission._id}/${action}`, { adminRemarks: remark });
      toast.success(`Permission ${action === "approve" ? "approved" : "rejected"}`);
      if (data.warning) toast.error(data.warning);
      setDecision(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeciding(false);
    }
  };

  if (!permissions) return <Loading />;

  return (
    <>
      <PageHeader
        title="Permission Requests"
        description={isManager ? "Review late coming, early leaving, personal, and official work permissions." : "Submit permission and track status."}
      />
      {!isManager ? (
        <>
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="surface-muted p-4">
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">Paid Permission Limit</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">{balance?.limit ?? 2} hours</p>
          </div>
          <div className="surface-muted p-4">
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">Used This Month</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">{balance?.used ?? 0}</p>
          </div>
          <div className="surface-muted p-4">
            <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">Remaining</p>
            <p className="mt-2 text-2xl font-black text-slate-950 dark:text-slate-100">{balance?.remaining ?? 2}</p>
          </div>
        </section>
        <form className="mb-6 panel p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="form-label">Permission Type</span>
              <select
                className="form-input"
                value={form.permissionType}
                onChange={(e) => setForm({ ...form, permissionType: e.target.value })}
              >
                {["Late Coming", "Early Leaving", "Personal Permission", "Official Work"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="form-label">Date</span>
              <input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span className="form-label">From Time</span>
              <input className="form-input" type="time" value={form.fromTime} onChange={(e) => setForm({ ...form, fromTime: e.target.value })} required />
            </label>
            <label className="space-y-1">
              <span className="form-label">To Time</span>
              <input className="form-input" type="time" value={form.toTime} onChange={(e) => setForm({ ...form, toTime: e.target.value })} required />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="form-label">Reason</span>
              <textarea className="form-input min-h-24" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
            </label>
          </div>
          <Button className="mt-5" disabled={saving} icon={Send} type="submit">
            Apply Permission
          </Button>
        </form>
        </>
      ) : null}
      <section className="panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Paid / Unpaid</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="px-4 py-3">Decision</th>
                {isManager ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => {
                const canDecide = canDecideRequest(permission, user);
                return (
                <tr key={permission._id}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={permission.employee?.name || user?.name} photo={permission.employee?.profilePhoto || user?.profilePhoto} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-950">{permission.employee?.name || user?.name || "-"}</p>
                        <p className="text-xs text-slate-500">{permission.employee?.employeeId || user?.employeeId || ""}</p>
                        <p className="text-xs text-slate-500">{permission.employee?.department || user?.department || ""}</p>
                        {isManager && balances[String(permission.employee?._id || "")] ? (
                          <p className="text-xs font-bold text-slate-900">
                            Balance: {balances[String(permission.employee?._id || "")].remaining} hrs
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">{permission.permissionType}</td>
                  <td className="table-cell">{formatDate(permission.date)}</td>
                  <td className="table-cell">{permission.fromTime} to {permission.toTime}</td>
                  <td className="table-cell">
                    <p className="font-semibold">{permission.paidHours ?? permission.requestedHours ?? "-"} paid</p>
                    <p className="text-xs text-slate-500">{permission.unpaidHours || 0} unpaid</p>
                    {permission.limitExceeded ? (
                      <p className="text-xs font-bold text-slate-900">Limit exceeded</p>
                    ) : null}
                  </td>
                  <td className="table-cell">
                    <DateTimeDisplay value={permission.createdAt} />
                  </td>
                  <td className="table-cell max-w-xs">{permission.reason}</td>
                  <td className="table-cell">
                    <RequestStatusBadge status={permission.status} />
                  </td>
                  <td className="table-cell">{permission.adminRemarks || "-"}</td>
                  <td className="table-cell">
                    {permission.approvedBy?.name ? (
                      <div>
                        <p className="font-semibold text-slate-900">{permission.approvedBy.name}</p>
                        <p className="text-xs text-slate-500">
                          <DateTimeDisplay value={permission.decidedAt || permission.updatedAt} />
                        </p>
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
                          onClick={() => setDecision({ action: "approve", permission })}
                          size="sm"
                          variant="success"
                        >
                          Approve
                        </Button>
                        <Button
                          disabled={!canDecide}
                          icon={XCircle}
                          onClick={() => setDecision({ action: "reject", permission })}
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
        {!permissions.length ? <EmptyState title="No permission requests" /> : null}
      </section>
      <DecisionDialog
        actionLabel={decision?.action === "approve" ? "Approve permission" : "Reject permission"}
        body={
          decision?.permission
            ? `${decision.permission.employee?.name || user?.name || "Employee"} | ${
                decision.permission.permissionType
              } | ${formatDate(decision.permission.date)}`
            : ""
        }
        loading={deciding}
        onClose={() => setDecision(null)}
        onSubmit={decide}
        open={Boolean(decision)}
        title={decision?.action === "approve" ? "Approve Permission Request" : "Reject Permission Request"}
        variant={decision?.action === "approve" ? "success" : "danger"}
      />
    </>
  );
}
