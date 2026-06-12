import { CheckCircle2, ClipboardList, Send, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DecisionDialog from "../components/DecisionDialog";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import RequestStatusBadge from "../components/RequestStatusBadge";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { canDecideRequest, requestRequesterMeta, requestRequesterName } from "../utils/requestAccess";
import { formatDate, formatDateTime, formatTime } from "../utils/formatters";

const requestConfig = [
  {
    key: "leave",
    label: "Leave",
    endpoint: "/leave/all",
    empty: "No leave requests found"
  },
  {
    key: "permission",
    label: "Permission",
    endpoint: "/permission/all",
    empty: "No permission requests found"
  },
  {
    key: "od",
    label: "OD",
    endpoint: "/od/all",
    empty: "No OD requests found"
  }
];

const sectionButtons = [
  { label: "Apply Leave", to: "/leave", icon: Send },
  { label: "Apply Permission", to: "/permission", icon: Send },
  { label: "Apply OD", to: "/od", icon: Send }
];

export default function DRIRequests({ mode = "assigned" }) {
  const { user } = useAuth();
  const [requestsByType, setRequestsByType] = useState(null);
  const [decision, setDecision] = useState(null);
  const [deciding, setDeciding] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [leave, permission, od] = await Promise.allSettled([
        api.get("/leave/all"),
        api.get("/permission/all"),
        api.get("/od/all")
      ]);
      setRequestsByType({
        leave: leave.status === "fulfilled" ? leave.value.data.leaves || [] : [],
        permission: permission.status === "fulfilled" ? permission.value.data.permissions || [] : [],
        od: od.status === "fulfilled" ? od.value.data.requests || [] : []
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [mode]);

  const assignedRequests = useMemo(() => {
    if (!requestsByType) return [];
    return requestConfig.flatMap((config) =>
      (requestsByType[config.key] || [])
        .filter((request) => canDecideRequest(request, user))
        .map((request) => ({ ...request, requestType: config.label, requestKey: config.key }))
    );
  }, [requestsByType, user]);

  const myRequests = useMemo(() => {
    if (!requestsByType) return [];
    return requestConfig.flatMap((config) =>
      (requestsByType[config.key] || []).map((request) => ({ ...request, requestType: config.label, requestKey: config.key }))
    );
  }, [requestsByType]);

  const rows = mode === "assigned" ? assignedRequests : myRequests;

  const approveReject = async (remark) => {
    if (!decision) return;
    const { request, requestKey, action } = decision;
    setDeciding(true);
    try {
      await api.put(`/${requestKey}/${request._id}/${action}`, { adminRemarks: remark });
      toast.success(`${request.requestType} ${action === "approve" ? "approved" : "rejected"}`);
      setDecision(null);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeciding(false);
    }
  };

  if (!requestsByType && loading) return <Loading />;

  return (
    <>
      <PageHeader
        title={mode === "assigned" ? "Assigned Requests" : "My Requests"}
        description={
          mode === "assigned"
            ? "Review requests assigned to your DRI role."
            : "Review your request history and jump into the request forms."
        }
        action={mode === "my" ? <Button as={Link} icon={ClipboardList} to="/leave" variant="secondary">Open Forms</Button> : null}
      />

      {mode === "my" ? (
        <section className="mb-6 flex flex-wrap gap-3">
          {sectionButtons.map((item) => {
            const Icon = item.icon;
            return (
              <Button as={Link} icon={Icon} key={item.to} to={item.to} variant="secondary">
                {item.label}
              </Button>
            );
          })}
        </section>
      ) : null}

      <section className="panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Raised At</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Decision</th>
                {mode === "assigned" ? <th className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={`${request.requestKey}-${request._id}`}>
                  <td className="table-cell font-semibold text-slate-950">{request.requestType}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={requestRequesterName(request, user?.name)} photo={request.employee?.profilePhoto || user?.profilePhoto} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-950">{requestRequesterName(request, user?.name)}</p>
                        <p className="text-xs text-slate-500">
                          {request.employee?.employeeId || user?.employeeId || "-"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-slate-600">{requestRequesterMeta(request) || "-"}</td>
                  <td className="table-cell text-sm">{formatDateTime(request.requestRaisedAt || request.createdAt)}</td>
                  <td className="table-cell max-w-xs">
                    {request.requestType === "Leave" ? (
                      <>
                        <p className="font-semibold">{request.leaveType}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(request.fromDate)} to {formatDate(request.toDate)}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
                      </>
                    ) : null}
                    {request.requestType === "Permission" ? (
                      <>
                        <p className="font-semibold">{request.permissionType}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(request.date)} | {request.fromTime} to {request.toTime}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
                      </>
                    ) : null}
                    {request.requestType === "OD" ? (
                      <>
                        <p className="font-semibold">{formatDate(request.odDate)}</p>
                        <p className="text-xs text-slate-500">
                          {request.fromTime} to {request.toTime} | {request.location}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
                      </>
                    ) : null}
                  </td>
                  <td className="table-cell text-sm">
                    <p className="font-semibold text-slate-950">{request.assignedApproverName || request.assignedDriName || "-"}</p>
                    <p className="text-xs text-slate-500">{request.assignedApproverRole?.toUpperCase() || "-"}</p>
                  </td>
                  <td className="table-cell">
                    <RequestStatusBadge status={request.status} />
                  </td>
                  <td className="table-cell">
                    {request.approvedBy?.name || request.reactedByName ? (
                      <div>
                        <p className="font-semibold text-slate-900">{request.approvedBy?.name || request.reactedByName}</p>
                        <p className="text-xs text-slate-500">
                          {request.reactedByRole?.toUpperCase() || request.approvedBy?.role?.toUpperCase() || "-"} |{" "}
                          {formatDateTime(request.reactedAt || request.decidedAt || request.updatedAt)}
                        </p>
                        {request.adminRemarks ? <p className="text-xs text-slate-500">{request.adminRemarks}</p> : null}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  {mode === "assigned" ? (
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <Button
                          disabled={request.status !== "Pending"}
                          icon={CheckCircle2}
                          onClick={() => setDecision({ action: "approve", request, requestKey: request.requestKey })}
                          size="sm"
                          variant="success"
                        >
                          Approve
                        </Button>
                        <Button
                          disabled={request.status !== "Pending"}
                          icon={XCircle}
                          onClick={() => setDecision({ action: "reject", request, requestKey: request.requestKey })}
                          size="sm"
                          variant="danger"
                        >
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
        {!rows.length ? (
          <EmptyState
            title={mode === "assigned" ? "No assigned requests" : "No request history"}
            body={mode === "assigned" ? "Requests assigned to your DRI role will appear here." : "Your requests will appear here."}
          />
        ) : null}
      </section>

      <DecisionDialog
        actionLabel={decision?.action === "approve" ? "Approve request" : "Reject request"}
        body={decision?.request ? `${decision.request.requestType} | ${requestRequesterName(decision.request, user?.name)}` : ""}
        loading={deciding}
        onClose={() => setDecision(null)}
        onSubmit={approveReject}
        open={Boolean(decision)}
        title={decision?.action === "approve" ? "Approve Request" : "Reject Request"}
        variant={decision?.action === "approve" ? "success" : "danger"}
      />
    </>
  );
}
