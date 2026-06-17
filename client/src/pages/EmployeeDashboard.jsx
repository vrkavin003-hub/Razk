import { CalendarCheck, Camera, Clock3, ExternalLink, LogIn, LogOut, Navigation, Send } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { mediaUrl } from "../config/api";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { uploadFile } from "../services/upload";
import { createWatermarkedAttendancePhoto } from "../utils/attendancePhoto";
import { getDeviceInfo } from "../utils/device";
import { formatDate, formatTime } from "../utils/formatters";
import { getAttendanceLocationPayload, googleMapsUrl } from "../utils/geolocation";
import { attendanceShift } from "../utils/shifts";

const locationUnavailableMessage = "Attendance marked, but location could not be captured.";

const defaultLeave = {
  leaveType: "Casual Leave",
  fromDate: "",
  toDate: "",
  reason: ""
};

export default function EmployeeDashboard({ title = "Employee Dashboard" }) {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [leaveForm, setLeaveForm] = useState(defaultLeave);
  const [locationState, setLocationState] = useState({
    coordinates: null,
    status: "Not checked",
    error: "",
    loading: false
  });
  const [attendancePhotoFile, setAttendancePhotoFile] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const load = async () => {
    const { data } = await api.get("/dashboard/employee");
    setDashboard(data);
  };

  useEffect(() => {
    load();
  }, []);

  const refreshLocation = async (notify = true) => {
    setLocationState((current) => ({ ...current, error: "", loading: true }));
    const location = await getAttendanceLocationPayload();
    const coordinates = location.latitude !== null && location.longitude !== null ? location : null;
    setLocationState({
      coordinates,
      status: location.locationStatus,
      error: location.locationError,
      loading: false
    });
    if (notify && location.locationStatus === "Captured") toast.success("Location captured successfully.");
    return location;
  };

  const attendanceAction = async (path, successMessage) => {
    setLoadingAction(true);
    try {
      const location = await refreshLocation(false);
      const payload = {
        employee_id: user?.employeeId,
        accuracy: location.accuracy,
        latitude: location.latitude,
        locationStatus: location.locationStatus,
        longitude: location.longitude
      };
      if (path.includes("check-in") && attendancePhotoFile) {
        const watermarkedPhoto = await createWatermarkedAttendancePhoto(attendancePhotoFile);
        const uploaded = await uploadFile(watermarkedPhoto, "image");
        payload.attendancePhoto = uploaded.url;
        payload.attendancePhotoDevice = getDeviceInfo().deviceName;
      }
      await api.post(path, payload);
      if (path.includes("check-in")) setAttendancePhotoFile(null);
      toast.success(location.locationStatus === "Captured" ? successMessage : location.locationStatus === "Permission denied" ? "Attendance marked, but location permission was not allowed." : locationUnavailableMessage);
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
      <PageHeader title={title} description="Today attendance, leave balance, requests, and announcements." />
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
                Working hours: {dashboard.workingHoursToday || 0} | Shift: {attendanceShift(dashboard.attendance || {})} | Pending requests: {dashboard.pendingRequests || 0}
              </p>
            </div>
            <StatusBadge status={dashboard.todayStatus} />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={loadingAction || Boolean(dashboard.attendance?.checkIn)}
              icon={LogIn}
              onClick={() => attendanceAction("/attendance/check-in", "Check-in marked successfully.")}
            >
              Check In
            </Button>
            <Button
              disabled={
                loadingAction ||
                !dashboard.attendance?.checkIn ||
                Boolean(dashboard.attendance?.checkOut)
              }
              icon={LogOut}
              onClick={() => attendanceAction("/attendance/check-out", "Check-out marked successfully.")}
              variant="success"
            >
              Check Out
            </Button>
            <Button disabled={locationState.loading} icon={Navigation} onClick={() => refreshLocation()} variant="secondary">
              {locationState.loading ? "Checking GPS..." : "Refresh Location"}
            </Button>
          </div>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="flex items-center gap-2 text-sm font-black text-slate-950">
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Attendance Photo
                </span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">
                  Optional check-in photo with automatic time and device watermark.
                </span>
              </span>
              <input
                accept="image/*"
                capture="environment"
                className="form-input sm:max-w-xs"
                disabled={loadingAction || Boolean(dashboard.attendance?.checkIn)}
                type="file"
                onChange={(event) => setAttendancePhotoFile(event.target.files?.[0] || null)}
              />
            </label>
            {attendancePhotoFile ? <p className="mt-2 text-xs font-semibold text-slate-500">{attendancePhotoFile.name}</p> : null}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500">Location Status</p>
              <p className="mt-2 text-sm font-bold text-slate-950">{locationState.status}</p>
              <p className="mt-1 text-xs text-slate-500">Attendance is allowed from any location.</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500">Coordinates</p>
              <p className="mt-2 text-sm font-black text-slate-950">
                {locationState.coordinates ? `${locationState.coordinates.latitude}, ${locationState.coordinates.longitude}` : "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Accuracy: {locationState.coordinates?.accuracy ? `${locationState.coordinates.accuracy}m` : "-"}</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500">Map</p>
              {locationState.coordinates ? (
                <a className="mt-2 inline-flex items-center gap-1 text-sm font-black text-slate-900" href={googleMapsUrl(locationState.coordinates.latitude, locationState.coordinates.longitude)} target="_blank" rel="noreferrer">
                  View Map
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-2 text-sm font-black text-slate-950">Location not available</p>
              )}
              <p className="mt-1 text-xs text-slate-500">GPS is optional</p>
            </div>
          </div>
          {locationState.error ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900">
              {locationState.error}
            </div>
          ) : null}
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="min-w-full">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">In</th>
                  <th className="px-4 py-3">Out</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">In Location</th>
                  <th className="px-4 py-3">Photo</th>
                  <th className="px-4 py-3">Out Location</th>
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
                    <td className="table-cell font-semibold">{attendanceShift(item)}</td>
                    <td className="table-cell">
                      <p className="font-semibold">{item.checkInLocationStatus || "Location not available"}</p>
                      <p className="text-xs text-slate-500">{item.checkInLatitude ?? "-"}, {item.checkInLongitude ?? "-"}</p>
                      {googleMapsUrl(item.checkInLatitude, item.checkInLongitude) ? (
                        <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={googleMapsUrl(item.checkInLatitude, item.checkInLongitude)} target="_blank" rel="noreferrer">
                          View Map <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </td>
                    <td className="table-cell">
                      {item.checkInPhoto ? (
                        <a className="inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={mediaUrl(item.checkInPhoto)} target="_blank" rel="noreferrer">
                          View Photo <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="table-cell">
                      <p className="font-semibold">{item.checkOutLocationStatus || "Location not available"}</p>
                      <p className="text-xs text-slate-500">{item.checkOutLatitude ?? "-"}, {item.checkOutLongitude ?? "-"}</p>
                      {googleMapsUrl(item.checkOutLatitude, item.checkOutLongitude) ? (
                        <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={googleMapsUrl(item.checkOutLatitude, item.checkOutLongitude)} target="_blank" rel="noreferrer">
                          View Map <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </td>
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
          </div>
          <div className="mt-6 space-y-3 md:hidden">
            {(dashboard.attendanceHistory || []).slice(0, 8).map((item) => (
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5" key={item._id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{formatDate(item.date)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">Shift: {attendanceShift(item)}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Check In</p>
                    <p className="mt-1 font-semibold text-slate-950">{formatTime(item.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Check Out</p>
                    <p className="mt-1 font-semibold text-slate-950">{formatTime(item.checkOut)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-black uppercase text-slate-500">Location</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{item.checkInLocationStatus || "Location not available"}</p>
                  <p className="text-xs text-slate-500">{item.checkInLatitude ?? "-"}, {item.checkInLongitude ?? "-"}</p>
                </div>
                {item.checkInPhoto ? (
                  <a className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={mediaUrl(item.checkInPhoto)} target="_blank" rel="noreferrer">
                    View Photo <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
          {!dashboard.attendanceHistory?.length ? <EmptyState title="No attendance yet" /> : null}
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
