import { CheckCircle2, Edit, Plus, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDateTime, initials } from "../utils/formatters";

export default function EmployeesList() {
  const { user } = useAuth();
  const canManageDevice = user?.role === "hr";
  const [employees, setEmployees] = useState(null);
  const [search, setSearch] = useState("");
  const [deviceActionId, setDeviceActionId] = useState("");

  const load = async () => {
    const { data } = await api.get("/employees", { params: search ? { search } : {} });
    setEmployees(data.employees);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (employee) => {
    if (!window.confirm(`Deactivate ${employee.name}?`)) return;
    try {
      await api.delete(`/employees/${employee._id}`);
      toast.success("Employee deactivated");
      await load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const resetDevice = async (employee) => {
    if (!window.confirm(`Reset this employee's registered device? The employee must request approval again from the new device.\n\n${employee.name} (${employee.employeeId})`)) return;
    setDeviceActionId(employee._id);
    try {
      await api.patch(`/employees/${employee._id}/reset-device`);
      toast.success("Employee device reset");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeviceActionId("");
    }
  };

  const approveDevice = async (employee) => {
    if (!window.confirm(`Approve this device for the employee? Only this device will be allowed to login.\n\n${employee.name} (${employee.employeeId})`)) return;
    setDeviceActionId(employee._id);
    try {
      await api.patch(`/employees/${employee._id}/device/approve`);
      toast.success("Employee device approved");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeviceActionId("");
    }
  };

  const rejectDevice = async (employee) => {
    if (!window.confirm(`Reject this employee device request?\n\n${employee.name} (${employee.employeeId})`)) return;
    setDeviceActionId(employee._id);
    try {
      await api.patch(`/employees/${employee._id}/device/reject`);
      toast.success("Employee device request rejected");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeviceActionId("");
    }
  };

  if (!employees) return <Loading />;

  return (
    <>
      <PageHeader
        title="Employees List"
        description="Manage employee records, departments, roles, and active status."
        action={
          <Link to="/employees/new">
            <Button icon={Plus}>Add Employee</Button>
          </Link>
        }
      />
      <div className="panel p-5">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between dark:border-slate-700">
          <div>
            <h2 className="text-base font-black text-slate-950 dark:text-slate-100">Employee Directory</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{employees.length} active records</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:max-w-xl sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="form-input pl-10"
                placeholder="Search name, email, or employee ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") load();
                }}
              />
            </div>
            <Button className="sm:w-32" icon={Search} onClick={load} variant="secondary">
              Search
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Designation</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee._id}>
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-950 text-xs font-black text-white dark:bg-slate-700">
                        {initials(employee.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950 dark:text-slate-100">{employee.name}</p>
                        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                          {employee.employeeId} | {employee.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">{employee.department || "-"}</td>
                  <td className="table-cell">{employee.designation || "-"}</td>
                  <td className="table-cell uppercase">{employee.role}</td>
                  <td className="table-cell">
                    {employee.role === "employee" ? (
                      <div>
                        <StatusBadge
                          status={
                            employee.deviceApprovalStatus === "approved" || employee.registeredDeviceName
                              ? "Approved"
                              : employee.deviceApprovalStatus === "pending"
                                ? "Pending"
                                : employee.deviceApprovalStatus === "rejected"
                                  ? "Rejected"
                                  : "Not Registered"
                          }
                        />
                        {employee.pendingDeviceName || employee.registeredDeviceName ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            {employee.pendingDeviceName || employee.registeredDeviceName}
                          </p>
                        ) : null}
                        {employee.deviceRequestedAt || employee.deviceRegisteredAt ? (
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            {formatDateTime(employee.deviceRequestedAt || employee.deviceRegisteredAt)}
                          </p>
                        ) : null}
                        {employee.deviceRejectedAt ? (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-200">
                            Rejected {formatDateTime(employee.deviceRejectedAt)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">Multiple devices allowed</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={employee.isActive ? "Present" : "Rejected"} />
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/employees/${employee._id}/edit`}>
                        <Button icon={Edit} size="sm" variant="secondary">
                          Edit
                        </Button>
                      </Link>
                      <Button icon={Trash2} onClick={() => remove(employee)} size="sm" variant="danger">
                        Deactivate
                      </Button>
                      {canManageDevice && employee.role === "employee" && employee.deviceApprovalStatus === "pending" ? (
                        <>
                          <Button disabled={Boolean(deviceActionId)} icon={CheckCircle2} onClick={() => approveDevice(employee)} size="sm" variant="success">
                            {deviceActionId === employee._id ? "Processing..." : "Approve Device"}
                          </Button>
                          <Button disabled={Boolean(deviceActionId)} icon={XCircle} onClick={() => rejectDevice(employee)} size="sm" variant="danger">
                            Reject Device
                          </Button>
                        </>
                      ) : null}
                      {canManageDevice && employee.role === "employee" && (employee.deviceApprovalStatus === "approved" || employee.deviceApprovalStatus === "rejected" || employee.registeredDeviceName) ? (
                        <Button disabled={Boolean(deviceActionId)} icon={RotateCcw} onClick={() => resetDevice(employee)} size="sm" variant="warning">
                          {deviceActionId === employee._id ? "Processing..." : "Reset Device"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!employees.length ? <EmptyState title="No employees found" /> : null}
      </div>
    </>
  );
}
