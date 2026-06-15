import { ExternalLink, Filter, LogIn, LogOut, MapPin, Navigation, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/Button";
import DateTimeDisplay from "../components/DateTimeDisplay";
import EmptyState from "../components/EmptyState";
import Loading from "../components/Loading";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { formatDate, formatDateTime } from "../utils/formatters";
import { getAttendanceLocationPayload, googleMapsUrl } from "../utils/geolocation";
import { roleMatches } from "../utils/formatters";
import { attendanceShift } from "../utils/shifts";

const locationUnavailableMessage = "Attendance marked, but location could not be captured.";

export default function AttendancePage() {
  const { user } = useAuth();
  const isManager = roleMatches(user?.role, ["admin", "hr"]);
  const canMarkAttendance = roleMatches(user?.role, ["employee", "hr", "dri"]);
  const [records, setRecords] = useState(null);
  const [today, setToday] = useState(null);
  const [filters, setFilters] = useState({ date: "", department: "", employeeId: "" });
  const [locationState, setLocationState] = useState({
    coordinates: null,
    status: "Not checked",
    error: "",
    loading: false
  });
  const [loadingAction, setLoadingAction] = useState(false);

  const load = async () => {
    if (isManager) {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      const requests = [api.get("/attendance/all", { params })];
      if (canMarkAttendance) requests.push(api.get("/attendance/today"));
      const [{ data }, todayResponse] = await Promise.all(requests);
      setRecords(data.attendance);
      if (todayResponse) setToday(todayResponse.data.attendance);
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

  const attendanceAction = async (path, message) => {
    setLoadingAction(true);
    try {
      const location = await refreshLocation(false);
      await api.post(path, {
        employee_id: user?.employeeId,
        accuracy: location.accuracy,
        latitude: location.latitude,
        locationStatus: location.locationStatus,
        longitude: location.longitude
      });
      toast.success(location.locationStatus === "Captured" ? message : location.locationStatus === "Permission denied" ? "Attendance marked, but location permission was not allowed." : locationUnavailableMessage);
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
      {canMarkAttendance ? (
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
              onClick={() => attendanceAction("/attendance/check-in", "Check-in marked successfully.")}
            >
              Check In
            </Button>
            <Button
              disabled={
                loadingAction ||
                !today?.checkIn ||
                Boolean(today?.checkOut)
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
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">Location Status</p>
              <p className="mt-2 text-sm font-black text-slate-950 dark:text-slate-100">{locationState.status}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Attendance is allowed from any location.</p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">Coordinates</p>
              <p className="mt-2 text-sm font-black text-slate-950 dark:text-slate-100">
                {locationState.coordinates ? `${locationState.coordinates.latitude}, ${locationState.coordinates.longitude}` : "-"}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                Accuracy: {locationState.coordinates?.accuracy ? `${locationState.coordinates.accuracy}m` : "-"}
              </p>
            </div>
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-300">Map</p>
              {locationState.coordinates ? (
                <a className="mt-2 inline-flex items-center gap-1 text-sm font-black text-slate-900" href={googleMapsUrl(locationState.coordinates.latitude, locationState.coordinates.longitude)} target="_blank" rel="noreferrer">
                  View Map
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                <p className="mt-2 text-sm font-black text-slate-950 dark:text-slate-100">Location not available</p>
              )}
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                GPS optional
              </p>
            </div>
          </div>
          {locationState.error ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900">
              {locationState.error}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="mb-6 panel p-5">
          <div className="mb-4 border-b border-slate-100 pb-4 dark:border-slate-700">
            <h2 className="text-base font-black text-slate-950 dark:text-slate-100">Attendance Filters</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Date, department, and employee view controls.</p>
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
                placeholder="RAZK-DEMO-EMP"
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
      <section className="panel p-5" id="attendance-records">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Date</th>
                {isManager ? <th className="px-4 py-3">Employee</th> : null}
                <th className="px-4 py-3">Check In</th>
                <th className="px-4 py-3">Check Out</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Check-In Location</th>
                <th className="px-4 py-3">Check-Out Location</th>
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
                      <div className="flex items-center gap-3">
                        <UserAvatar name={record.employee?.name} photo={record.employee?.profilePhoto} size="sm" />
                        <div>
                          <p className="font-semibold text-slate-900">{record.employee?.name || "-"}</p>
                          <p className="text-xs text-slate-500">{record.employeeId}</p>
                        </div>
                      </div>
                    </td>
                  ) : null}
                  <td className="table-cell">{formatDateTime(record.checkIn)}</td>
                  <td className="table-cell">{formatDateTime(record.checkOut)}</td>
                  <td className="table-cell font-semibold">{attendanceShift(record)}</td>
                  <td className="table-cell">
                    <p className="font-semibold">{record.checkInLocationStatus || "Location not available"}</p>
                    <p className="text-xs text-slate-500">{record.checkInLatitude ?? "-"}, {record.checkInLongitude ?? "-"}</p>
                    <p className="text-xs text-slate-500">Accuracy: {record.checkInAccuracy ?? "-"} m</p>
                    {googleMapsUrl(record.checkInLatitude, record.checkInLongitude) ? (
                      <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={googleMapsUrl(record.checkInLatitude, record.checkInLongitude)} target="_blank" rel="noreferrer">
                        View Map <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </td>
                  <td className="table-cell">
                    <p className="font-semibold">{record.checkOutLocationStatus || "Location not available"}</p>
                    <p className="text-xs text-slate-500">{record.checkOutLatitude ?? "-"}, {record.checkOutLongitude ?? "-"}</p>
                    <p className="text-xs text-slate-500">Accuracy: {record.checkOutAccuracy ?? "-"} m</p>
                    {googleMapsUrl(record.checkOutLatitude, record.checkOutLongitude) ? (
                      <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={googleMapsUrl(record.checkOutLatitude, record.checkOutLongitude)} target="_blank" rel="noreferrer">
                        View Map <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </td>
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
        <div className="space-y-3 md:hidden">
          {records.map((record) => (
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5" key={record._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950">
                    {isManager ? record.employee?.name || record.employeeId : formatDate(record.date)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {isManager ? `${record.employeeId} | ${formatDate(record.date)}` : attendanceShift(record)}
                  </p>
                </div>
                <StatusBadge status={record.status} />
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Check In</p>
                    <p className="mt-1 font-semibold text-slate-950">{formatDateTime(record.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Check Out</p>
                    <p className="mt-1 font-semibold text-slate-950">{formatDateTime(record.checkOut)}</p>
                  </div>
                </div>
                {isManager ? (
                  <div>
                    <p className="text-xs font-black uppercase text-slate-500">Shift</p>
                    <p className="mt-1 font-semibold text-slate-950">{attendanceShift(record)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Check-In Location</p>
                  <p className="mt-1 font-semibold text-slate-950">{record.checkInLocationStatus || "Location not available"}</p>
                  <p className="text-xs text-slate-500">{record.checkInLatitude ?? "-"}, {record.checkInLongitude ?? "-"}</p>
                  {googleMapsUrl(record.checkInLatitude, record.checkInLongitude) ? (
                    <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={googleMapsUrl(record.checkInLatitude, record.checkInLongitude)} target="_blank" rel="noreferrer">
                      View Map <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-slate-500">Check-Out Location</p>
                  <p className="mt-1 font-semibold text-slate-950">{record.checkOutLocationStatus || "Location not available"}</p>
                  <p className="text-xs text-slate-500">{record.checkOutLatitude ?? "-"}, {record.checkOutLongitude ?? "-"}</p>
                  {googleMapsUrl(record.checkOutLatitude, record.checkOutLongitude) ? (
                    <a className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-slate-900" href={googleMapsUrl(record.checkOutLatitude, record.checkOutLongitude)} target="_blank" rel="noreferrer">
                      View Map <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs font-black uppercase text-slate-500">Hours</span>
                  <span className="font-black text-slate-950">{record.workingHours || 0}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!records.length ? <EmptyState title="No attendance records" /> : null}
      </section>
    </>
  );
}
