import { CalendarCheck, Clock3, LogIn, LogOut, Navigation, Send } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate, formatTime } from "../utils/formatters";
import { evaluateOfficeLocation, getBrowserLocation } from "../utils/geolocation";

const outsideLocationMessage = "You are outside the allowed company location. Attendance cannot be marked.";

const defaultLeave = {
  leaveType: "Casual Leave",
  fromDate: "",
  toDate: "",
  reason: ""
};

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [leaveForm, setLeaveForm] = useState(defaultLeave);
  const [office, setOffice] = useState(null);
  const [locationState, setLocationState] = useState({
    coordinates: null,
    decision: null,
    error: "",
    loading: false
  });
  const [loadingAction, setLoadingAction] = useState(false);

  const load = async () => {
    const { data } = await api.get("/dashboard/employee");
    setDashboard(data);
  };

  useEffect(() => {
    load();
    api
      .get("/office-location")
      .then(({ data }) => setOffice(data.activeOffice))
      .catch((error) => setLocationState((current) => ({ ...current, error: error.message })));
  }, []);

  const refreshLocation = async () => {
    setLocationState((current) => ({ ...current, error: "", loading: true }));
    try {
      const activeOffice = office || (await api.get("/office-location")).data.activeOffice;
      if (!activeOffice) throw new Error("No active office location is configured. Please contact admin.");
      setOffice(activeOffice);
      const coordinates = await getBrowserLocation();
      const decision = evaluateOfficeLocation(coordinates, activeOffice);
      setLocationState({ coordinates, decision, error: "", loading: false });
      return { coordinates, decision };
    } catch (error) {
      setLocationState((current) => ({ ...current, error: error.message, loading: false }));
      throw error;
    }
  };

  const attendanceAction = async (path, successMessage) => {
    setLoadingAction(true);
    try {
      const { coordinates, decision } = await refreshLocation();
      if (!decision?.inside) throw new Error(outsideLocationMessage);
      await api.post(path, {
        employee_id: user?.employeeId,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      });
      toast.success(successMessage);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  const applyLeave = async (event) => {
    event.preventDefault();
    setLoadingAction(true);
    try {
      await api.post("/leave/apply", leaveForm);
      setLeaveForm(defaultLeave);
      toast.success("Leave request submitted");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingAction(false);
    }
  };

  if (!dashboard) return <Loading />;

  return (
    <>
      <PageHeader title="Employee Dashboard" description="Today attendance, leave balance, requests, and announcements." />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today Status" value={dashboard.todayStatus} icon={CalendarCheck} tone="blue" />
        <StatCard label="Check In" value={formatTime(dashboard.attendance?.checkIn)} icon={LogIn} tone="green" />
        <StatCard label="Check Out" value={formatTime(dashboard.attendance?.checkOut)} icon={LogOut} tone="amber" />
        <StatCard label="Leave Balance" value={dashboard.leaveBalance} icon={Clock3} tone="slate" />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Today Attendance</h2>
              <p className="mt-1 text-sm text-slate-500">
                Working hours: {dashboard.workingHoursToday || 0} | Pending requests: {dashboard.pendingRequests || 0}
              </p>
            </div>
            <StatusBadge status={dashboard.todayStatus} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={loadingAction || Boolean(dashboard.attendance?.checkIn) || (locationState.decision && !locationState.decision.inside)}
              icon={LogIn}
              onClick={() => attendanceAction("/attendance/check-in", "Checked in successfully")}
            >
              Check In
            </Button>
            <Button
              disabled={
                loadingAction ||
                !dashboard.attendance?.checkIn ||
                Boolean(dashboard.attendance?.checkOut) ||
                (locationState.decision && !locationState.decision.inside)
              }
              icon={LogOut}
              onClick={() => attendanceAction("/attendance/check-out", "Checked out successfully")}
              variant="success"
            >
              Check Out
            </Button>
            <Button disabled={locationState.loading} icon={Navigation} onClick={refreshLocation} variant="secondary">
              {locationState.loading ? "Checking GPS..." : "Refresh Location"}
            </Button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500">Office</p>
              <p className="mt-2 text-sm font-bold text-slate-950">{office?.officeName || "Not configured"}</p>
              <p className="mt-1 text-xs text-slate-500">Radius: {office?.radiusMeters || "-"} meters</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500">GPS Status</p>
              <p className={`mt-2 text-sm font-black ${locationState.decision?.inside ? "text-emerald-700" : locationState.decision ? "text-rose-700" : "text-slate-700"}`}>
                {locationState.decision?.status || "Not checked"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Accuracy: {locationState.coordinates?.accuracy ? `${locationState.coordinates.accuracy}m` : "-"}</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500">Distance</p>
              <p className="mt-2 text-sm font-black text-slate-950">
                {locationState.decision ? `${locationState.decision.distanceMeters} meters` : "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500">HTTPS or localhost required</p>
            </div>
          </div>
          {locationState.error || (locationState.decision && !locationState.decision.inside) ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {locationState.decision && !locationState.decision.inside ? outsideLocationMessage : locationState.error}
            </div>
          ) : null}
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3">Out</th>
                  <th className="px-4 py-3">Hours</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard.attendanceHistory || []).slice(0, 8).map((item) => (
                  <tr key={item._id}>
                    <td className="table-cell font-semibold text-slate-900">{formatDate(item.date)}</td>
                    <td className="table-cell">{formatTime(item.checkIn)}</td>
                    <td className="table-cell">{formatTime(item.checkOut)}</td>
                    <td className="table-cell">{item.workingHours || 0}</td>
                    <td className="table-cell">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="table-cell">
                      <DateTimeDisplay value={item.updatedAt || item.checkOut || item.checkIn} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dashboard.attendanceHistory?.length ? <EmptyState title="No attendance yet" /> : null}
          </div>
        </div>
        <form className="panel p-5" onSubmit={applyLeave}>
          <h2 className="text-base font-bold text-slate-950">Apply Leave</h2>
          <div className="mt-4 space-y-4">
            <label className="block space-y-1">
              <span className="form-label">Leave Type</span>
              <select
                className="form-input"
                value={leaveForm.leaveType}
                onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}
              >
                {["Casual Leave", "Sick Leave", "Emergency Leave", "Paid Leave"].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="form-label">From Date</span>
                <input
                  className="form-input"
                  type="date"
                  value={leaveForm.fromDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="form-label">To Date</span>
                <input
                  className="form-input"
                  type="date"
                  value={leaveForm.toDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })}
                  required
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="form-label">Reason</span>
              <textarea
                className="form-input min-h-24"
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                required
              />
            </label>
          </div>
          <Button className="mt-5 w-full" disabled={loadingAction} icon={Send} type="submit">
            Submit Leave
          </Button>
        </form>
      </section>
      <section className="mt-6 panel p-5">
        <h2 className="text-base font-bold text-slate-950">Recent Announcements</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(dashboard.announcements || []).map((announcement) => (
            <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={announcement._id}>
              <p className="text-sm font-bold text-slate-950">{announcement.title}</p>
              <p className="mt-2 text-sm text-slate-600">{announcement.message}</p>
            </article>
          ))}
        </div>
        {!dashboard.announcements?.length ? <EmptyState title="No announcements" /> : null}
      </section>
    </>
  );
}
