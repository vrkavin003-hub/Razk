import {
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  FileClock,
  Gauge,
  TrendingUp,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import api from "../services/api";
import Loading from "./Loading";
import PageHeader from "./PageHeader";
import StatCard from "./StatCard";

const leaveColors = ["#f59e0b", "#10b981", "#e11d48"];
const chartGrid = "#dbe5ef";
const tooltipStyle = {
  border: "1px solid #dbe5ef",
  borderRadius: 8,
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)"
};

export default function OrgDashboard({ endpoint, title }) {
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    api.get(endpoint).then(({ data }) => setDashboard(data));
  }, [endpoint]);

  if (!dashboard) return <Loading />;

  const cards = dashboard.cards || {};
  const statCards = [
    ["Total Employees", cards.totalEmployees, Users, "blue"],
    ["Present Today", cards.presentToday, CalendarDays, "green"],
    ["Absent Today", cards.absentToday, AlertTriangle, "rose"],
    ["Late Today", cards.lateToday, Clock3, "amber"],
    ["Pending Leave", cards.pendingLeaveRequests, FileClock, "amber"],
    ["Pending Permission", cards.pendingPermissionRequests, Gauge, "slate"],
    ["Pending OD", cards.pendingODRequests, Briefcase, "blue"],
    ["Departments", cards.totalDepartments, Building2, "blue"],
    ["Monthly Attendance", `${cards.monthlyAttendancePercentage || 0}%`, TrendingUp, "green"]
  ];
  const pendingTotal =
    (cards.pendingLeaveRequests || 0) + (cards.pendingPermissionRequests || 0) + (cards.pendingODRequests || 0);

  return (
    <>
      <PageHeader
        title={title}
        description="Live attendance, approvals, department movement, and monthly health for HYA Tech."
      />
      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-hya-600 dark:text-blue-300">
                Operations Health
              </p>
              <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-blue-50">
                {cards.monthlyAttendancePercentage || 0}% monthly attendance
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-blue-200">
                {cards.presentToday || 0} present today across {cards.totalDepartments || 0} active departments.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="surface-muted p-4">
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-blue-200">Pending</p>
                <p className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-200">{pendingTotal}</p>
              </div>
              <div className="surface-muted p-4">
                <p className="text-xs font-bold uppercase text-slate-500 dark:text-blue-200">Late</p>
                <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-200">{cards.lateToday || 0}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="panel p-5">
          <p className="text-sm font-black text-slate-950 dark:text-blue-50">Today Coverage</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-[#09192e]">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(((cards.presentToday || 0) / Math.max(cards.totalEmployees || 1, 1)) * 100)
                )}%`
              }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-500 dark:text-blue-200">Present</span>
            <span className="font-black text-slate-950 dark:text-blue-50">
              {cards.presentToday || 0}/{cards.totalEmployees || 0}
            </span>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(([label, value, Icon, tone]) => (
          <StatCard key={label} label={label} value={value} icon={Icon} tone={tone} />
        ))}
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="panel overflow-hidden xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-[#203e6f]">
            <h2 className="text-base font-black text-slate-950 dark:text-blue-50">Weekly Attendance</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-blue-200">Present, late, and absent movement.</p>
          </div>
          <div className="h-80 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.weeklyAttendance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                <Legend />
                <Bar dataKey="present" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="late" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="absent" fill="#e11d48" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4 dark:border-[#203e6f]">
            <h2 className="text-base font-black text-slate-950 dark:text-blue-50">Leave Status</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-blue-200">Current request mix.</p>
          </div>
          <div className="h-80 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboard.leaveStatusChart || []}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={3}
                >
                  {(dashboard.leaveStatusChart || []).map((entry, index) => (
                    <Cell key={entry.status} fill={leaveColors[index % leaveColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="mt-6 panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 dark:border-[#203e6f]">
          <h2 className="text-base font-black text-slate-950 dark:text-blue-50">Department Attendance Today</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-blue-200">Department-level presence and gap view.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Absent</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.departmentAttendance || []).map((row) => (
                <tr key={row.department}>
                  <td className="table-cell font-semibold text-slate-900 dark:text-blue-50">{row.department}</td>
                  <td className="table-cell">{row.total}</td>
                  <td className="table-cell text-emerald-700">{row.present}</td>
                  <td className="table-cell text-rose-700">{row.absent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
