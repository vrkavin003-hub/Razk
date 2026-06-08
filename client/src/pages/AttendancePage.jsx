import { Filter, LogIn, LogOut, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate, formatDateTime } from "../utils/formatters";

export default function AttendancePage() {
  const { user } = useAuth();
  const isManager = ["admin", "hr"].includes(user?.role);
  const [records, setRecords] = useState(null);
  const [today, setToday] = useState(null);
  const [filters, setFilters] = useState({ date: "", department: "", employeeId: "" });
  const [loadingAction, setLoadingAction] = useState(false);

  const load = async () => {
    if (isManager) {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const { data } = await api.get("/attendance/all", { params });
      setRecords(data.attendance);
    } else {
      const [{ data: todayData }, { data: historyData }] = await Promise.all([
        api.get("/attendance/today"),
        api.get("/attendance/my-history")
      ]);
      setToday(todayData.attendance);
      setRecords(historyData.attendance);
    }
  };

  useEffect(() => {
    load();
  }, [isManager]);

  const attendanceAction = async (path, message) => {
    setLoadingAction(true);
    try {
      await api.post(path);
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  if (!records) return <Loading />;

  return (
    <>
      <PageHeader
        title="Attendance"
        description={isManager ? "View check-in, check-out, late, and half-day records." : "Mark attendance and view your history."}
        action={
          <Button icon={RefreshCcw} onClick={load} variant="secondary">
            Refresh
          </Button>
        }
      />
      {!isManager ? (
        <section className="mb-6 panel p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Today</h2>
              <p className="mt-1 text-sm text-slate-500">
                Check-in: {formatDateTime(today?.checkIn)} | Check-out: {formatDateTime(today?.checkOut)}
              </p>
            </div>
            <StatusBadge status={today?.status || "Absent"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={loadingAction || Boolean(today?.checkIn)}
              icon={LogIn}
              onClick={() => attendanceAction("/attendance/check-in", "Checked in successfully")}
            >
              Check In
            </Button>
            <Button
              disabled={loadingAction || !today?.checkIn || Boolean(today?.checkOut)}
              icon={LogOut}
              onClick={() => attendanceAction("/attendance/check-out", "Checked out successfully")}
              variant="success"
            >
              Check Out
            </Button>
          </div>
        </section>
      ) : (
        <section className="mb-6 panel p-5">
          <div className="mb-4 border-b border-slate-100 pb-4 dark:border-[#203e6f]">
            <h2 className="text-base font-black text-slate-950 dark:text-blue-50">Attendance Filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-blue-200">Date, department, and employee view controls.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1.5">
              <span className="form-label">Date</span>
              <input
                className="form-input"
                type="date"
                value={filters.date}
                onChange={(event) => setFilters({ ...filters, date: event.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="form-label">Department</span>
              <input
                className="form-input"
                placeholder="Production"
                value={filters.department}
                onChange={(event) => setFilters({ ...filters, department: event.target.value })}
              />
            </label>
            <label className="space-y-1.5">
              <span className="form-label">Employee ID</span>
              <input
                className="form-input"
                placeholder="HYA-DEMO-EMP"
                value={filters.employeeId}
                onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}
              />
            </label>
            <div className="flex items-end">
              <Button className="w-full" icon={Filter} onClick={load}>
                Apply
              </Button>
            </div>
          </div>
        </section>
      )}
      <section className="panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Date</th>
                {isManager ? <th className="px-4 py-3">Employee</th> : null}
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  <td className="table-cell font-semibold text-slate-950">{formatDate(record.date)}</td>
                  {isManager ? (
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{record.employee?.name || "-"}</p>
                      <p className="text-xs text-slate-500">{record.employeeId}</p>
                    </td>
                  ) : null}
                  <td className="table-cell">{formatDateTime(record.checkIn)}</td>
                  <td className="table-cell">{formatDateTime(record.checkOut)}</td>
                  <td className="table-cell">{record.workingHours || 0}</td>
                  <td className="table-cell">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="table-cell">
                    <DateTimeDisplay value={record.updatedAt || record.checkOut || record.checkIn} />
                  </td>
                  <td className="table-cell">{record.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!records.length ? <EmptyState title="No attendance records" /> : null}
      </section>
    </>
  );
}
