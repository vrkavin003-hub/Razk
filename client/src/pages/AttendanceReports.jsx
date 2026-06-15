import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AnnouncementCard from "../components/AnnouncementCard";
import Button from "../components/Button";
import CompanyLogo from "../components/CompanyLogo";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import api from "../services/api";
import { formatDate, formatTime } from "../utils/formatters";
import { attendanceShift } from "../utils/shifts";

const today = new Date();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const currentYear = String(today.getFullYear());

const reportTypes = [
  { value: "employee", label: "Single Employee" },
  { value: "monthly", label: "All Employees Monthly" },
  { value: "department", label: "Department-wise" },
  { value: "all", label: "Custom Date Range" }
];

const defaultFilters = {
  type: "employee",
  employeeId: "",
  department: "",
  from: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10),
  to: today.toISOString().slice(0, 10),
  month: currentMonth,
  year: currentYear
};

export default function AttendanceReports() {
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState(defaultFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/employees")
      .then(({ data }) => {
        setEmployees(data.employees || []);
        const firstEmployee = data.employees?.find((employee) => employee.role !== "admin");
        if (firstEmployee) {
          setFilters((current) => ({
            ...current,
            employeeId: firstEmployee.employeeId,
            department: firstEmployee.department || current.department
          }));
        }
      })
      .catch((error) => toast.error(error.message));
  }, []);

  const departments = useMemo(
    () => [...new Set(employees.map((employee) => employee.department).filter(Boolean))],
    [employees]
  );

  const reportEndpoint = (format = "") => {
    const suffix = format ? `/${format}` : "";
    if (filters.type === "employee") {
      return {
        url: `/reports/employee/${encodeURIComponent(filters.employeeId)}${suffix}`,
        params: { from: filters.from, to: filters.to }
      };
    }
    if (filters.type === "monthly") {
      return {
        url: `/reports/monthly${suffix}`,
        params: { month: filters.month, year: filters.year }
      };
    }
    if (filters.type === "department") {
      return {
        url: `/reports/department/${encodeURIComponent(filters.department)}${suffix}`,
        params: { from: filters.from, to: filters.to }
      };
    }
    return {
      url: `/reports/custom${suffix}`,
      params: { type: "all", from: filters.from, to: filters.to }
    };
  };

  const validate = () => {
    if (filters.type === "employee" && !filters.employeeId) return "Select an employee";
    if (filters.type === "department" && !filters.department) return "Select a department";
    if (filters.type === "monthly" && (!filters.month || !filters.year)) return "Select month and year";
    if (filters.type !== "monthly" && (!filters.from || !filters.to)) return "Select date range";
    return "";
  };

  const preview = async () => {
    const validation = validate();
    if (validation) {
      toast.error(validation);
      return;
    }

    setLoading(true);
    try {
      const endpoint = reportEndpoint(false);
      const { data } = await api.get(endpoint.url, { params: endpoint.params });
      setReport(data.report);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    const validation = validate();
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      const endpoint = reportEndpoint("pdf");
      const response = await api.get(endpoint.url, {
        params: endpoint.params,
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filters.type}-attendance-report.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const exportExcel = async () => {
    const validation = validate();
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      const endpoint = reportEndpoint("excel");
      const response = await api.get(endpoint.url, {
        params: endpoint.params,
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filters.type}-attendance-report.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const update = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));

  const summary = report?.summary || {};
  const summaryCards = [
    ["Present", summary.present || 0],
    ["Absent", summary.absent || 0],
    ["Late", summary.late || 0],
    ["Half Day", summary.halfDay || 0],
    ["Leave", summary.leave || 0],
    ["Week Off", summary.weekOff || 0],
    ["Working Hours", summary.totalWorkingHours || 0],
    ["Attendance %", `${summary.attendancePercentage ?? "-"}%`]
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Generate professional attendance reports and export PDF or Excel files with Razk Automation branding."
        action={
          <div className="flex flex-wrap gap-2">
            <Button icon={FileSpreadsheet} onClick={exportExcel} variant="secondary">
              Export Excel
            </Button>
            <Button icon={Download} onClick={exportPdf}>
              Export PDF
            </Button>
          </div>
        }
      />
      <section className="panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <CompanyLogo compact />
          <div>
            <h2 className="text-base font-bold text-slate-950">Report Builder</h2>
            <p className="text-sm text-slate-500">Preview reports before downloading the PDF.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="form-label">Report Type</span>
            <select className="form-input" value={filters.type} onChange={update("type")}>
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          {filters.type === "employee" ? (
            <label className="space-y-1">
              <span className="form-label">Employee</span>
              <select className="form-input" value={filters.employeeId} onChange={update("employeeId")}>
                {employees
                  .filter((employee) => employee.role !== "admin")
                  .map((employee) => (
                    <option key={employee._id} value={employee.employeeId}>
                      {employee.employeeId} - {employee.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          {filters.type === "department" ? (
            <label className="space-y-1">
              <span className="form-label">Department</span>
              <select className="form-input" value={filters.department} onChange={update("department")}>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {filters.type === "monthly" ? (
            <>
              <label className="space-y-1">
                <span className="form-label">Month</span>
                <input className="form-input" max="12" min="1" type="number" value={filters.month} onChange={update("month")} />
              </label>
              <label className="space-y-1">
                <span className="form-label">Year</span>
                <input className="form-input" min="2024" type="number" value={filters.year} onChange={update("year")} />
              </label>
            </>
          ) : (
            <>
              <label className="space-y-1">
                <span className="form-label">From Date</span>
                <input className="form-input" type="date" value={filters.from} onChange={update("from")} />
              </label>
              <label className="space-y-1">
                <span className="form-label">To Date</span>
                <input className="form-input" type="date" value={filters.to} onChange={update("to")} />
              </label>
            </>
          )}
          <div className="flex items-end gap-2">
            <Button className="w-full" disabled={loading} icon={Search} onClick={preview}>
              {loading ? "Generating..." : "Preview"}
            </Button>
          </div>
        </div>
      </section>

      {report ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(([label, value]) => (
              <StatCard key={label} label={label} value={value} icon={FileText} tone="blue" />
            ))}
          </section>
          <section className="mt-6 panel p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">{report.title}</h2>
                <p className="text-sm text-slate-500">
                  {formatDate(report.from)} to {formatDate(report.to)}
                </p>
              </div>
              <Button icon={Download} onClick={exportPdf} variant="secondary">
                Download PDF
              </Button>
              <Button icon={FileSpreadsheet} onClick={exportExcel} variant="secondary">
                Download Excel
              </Button>
            </div>
            {report.employee ? (
              <AnnouncementCard
                announcement={{
                  title: `${report.employee.employeeId} - ${report.employee.name}`,
                  targetRole: report.employee.department,
                  createdAt: report.generatedAt,
                  message: `${report.employee.designation || "-"} | Joining: ${
                    report.employee.joiningDate ? formatDate(report.employee.joiningDate) : "-"
                  }`,
                  createdBy: report.generatedBy
                }}
              />
            ) : null}
            <ReportTable report={report} />
          </section>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState title="No report preview" body="Choose filters and click Preview to generate attendance data." />
        </div>
      )}
    </>
  );
}

function ReportTable({ report }) {
  if (report.type === "employee") {
    return (
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Check-in</th>
              <th className="px-4 py-3">Check-out</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Check-in Location</th>
              <th className="px-4 py-3">Check-out Location</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {report.records.map((record) => (
              <tr key={record.date}>
                <td className="table-cell font-semibold text-slate-950">{formatDate(record.date)}</td>
                <td className="table-cell">{record.day}</td>
                <td className="table-cell">{formatTime(record.checkIn)}</td>
                <td className="table-cell">{formatTime(record.checkOut)}</td>
                <td className="table-cell font-semibold">{attendanceShift(record)}</td>
                <td className="table-cell">
                  <p className="font-semibold">{record.checkInLocationStatus || "Location not available"}</p>
                  <p className="text-xs text-slate-500">
                    {record.checkInLatitude || record.checkInLatitude === 0 ? record.checkInLatitude : "-"},{" "}
                    {record.checkInLongitude || record.checkInLongitude === 0 ? record.checkInLongitude : "-"}
                  </p>
                </td>
                <td className="table-cell">
                  <p className="font-semibold">{record.checkOutLocationStatus || "Location not available"}</p>
                  <p className="text-xs text-slate-500">
                    {record.checkOutLatitude || record.checkOutLatitude === 0 ? record.checkOutLatitude : "-"},{" "}
                    {record.checkOutLongitude || record.checkOutLongitude === 0 ? record.checkOutLongitude : "-"}
                  </p>
                </td>
                <td className="table-cell">{record.workingHours}</td>
                <td className="table-cell">
                  <StatusBadge status={record.status} />
                </td>
                <td className="table-cell">{record.remarks || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-x-auto">
      <table className="min-w-full">
        <thead className="table-head">
          <tr>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Department</th>
            <th className="px-4 py-3">Present</th>
            <th className="px-4 py-3">Absent</th>
            <th className="px-4 py-3">Late</th>
            <th className="px-4 py-3">Half Day</th>
            <th className="px-4 py-3">Leave</th>
            <th className="px-4 py-3">Hours</th>
            <th className="px-4 py-3">Attendance %</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.employee._id}>
              <td className="table-cell">
                <p className="font-semibold text-slate-950">{row.employee.name}</p>
                <p className="text-xs text-slate-500">{row.employee.employeeId}</p>
              </td>
              <td className="table-cell">{row.employee.department || "-"}</td>
              <td className="table-cell">{row.summary.present}</td>
              <td className="table-cell">{row.summary.absent}</td>
              <td className="table-cell">{row.summary.late}</td>
              <td className="table-cell">{row.summary.halfDay}</td>
              <td className="table-cell">{row.summary.leave}</td>
              <td className="table-cell">{row.summary.totalWorkingHours}</td>
              <td className="table-cell">{row.summary.attendancePercentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
