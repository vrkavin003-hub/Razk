const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { toDateKey } = require("./dates");
const { getShiftFromCheckIn } = require("./shifts");
const { isAssignedWeekOffDate, normalizeWeekOffDay } = require("./weekOff");

const logoPath = path.join(__dirname, "..", "assets", "razk-logo.jpeg");

const parseDateKey = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDateKey = (date) => toDateKey(date);

const enumerateDates = (from, to) => {
  const dates = [];
  const cursor = parseDateKey(from);
  const end = parseDateKey(to);

  while (cursor <= end) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));

const formatTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};

const formatDateTime = (value = new Date()) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const dayName = (dateKey) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short"
  }).format(new Date(`${dateKey}T00:00:00`));

const statusCode = (status) => {
  if (status === "Present") return "P";
  if (status === "Late") return "L";
  if (status === "Half Day") return "HD";
  if (status === "Leave") return "LV";
  if (status === "Week Off") return "WO";
  return "A";
};

const approvedLeaveForDate = (leaves, dateKey) =>
  leaves.find((leave) => {
    if (leave.status !== "Approved") return false;
    return dateKey >= formatDateKey(leave.fromDate) && dateKey <= formatDateKey(leave.toDate);
  });

const attendanceForDate = (attendance, dateKey) => attendance.find((record) => record.date === dateKey);

const buildDailyRecords = ({ employee, attendance, leaves, from, to }) =>
  enumerateDates(from, to).map((dateKey) => {
    const attendanceRecord = attendanceForDate(attendance, dateKey);
    const leaveRecord = approvedLeaveForDate(leaves, dateKey);
    let status = "Absent";
    let remarks = "";

    if (attendanceRecord) {
      status = attendanceRecord.status || "Present";
      remarks = attendanceRecord.remarks || "";
    } else if (leaveRecord) {
      status = "Leave";
      remarks = leaveRecord.leaveType || "Approved leave";
    } else if (isAssignedWeekOffDate(employee, dateKey)) {
      status = "Week Off";
      remarks = normalizeWeekOffDay(employee?.weeklyWeekOffDay);
    }

    return {
      employee,
      date: dateKey,
      day: dayName(dateKey),
      checkIn: attendanceRecord?.checkIn || attendanceRecord?.checkInTime || null,
      checkOut: attendanceRecord?.checkOut || attendanceRecord?.checkOutTime || null,
      shiftName:
        attendanceRecord?.shiftName ||
        getShiftFromCheckIn(attendanceRecord?.checkIn || attendanceRecord?.checkInTime, employee?.assignedShift),
      workingHours: Number(attendanceRecord?.workingHours || 0),
      attendanceSite: attendanceRecord?.attendanceSite || "",
      checkInLocationStatus: attendanceRecord?.checkInLocationStatus || "Unknown",
      checkInLatitude: attendanceRecord?.checkInLatitude ?? "",
      checkInLongitude: attendanceRecord?.checkInLongitude ?? "",
      checkInAccuracy: attendanceRecord?.checkInAccuracy ?? "",
      checkInDistanceMeters: attendanceRecord?.checkInDistanceMeters ?? "",
      checkOutLocationStatus: attendanceRecord?.checkOutLocationStatus || "Unknown",
      checkOutLatitude: attendanceRecord?.checkOutLatitude ?? "",
      checkOutLongitude: attendanceRecord?.checkOutLongitude ?? "",
      checkOutAccuracy: attendanceRecord?.checkOutAccuracy ?? "",
      checkOutDistanceMeters: attendanceRecord?.checkOutDistanceMeters ?? "",
      status,
      statusCode: statusCode(status),
      remarks
    };
  });

const summarizeRecords = (records) => {
  const summary = records.reduce(
    (acc, record) => {
      acc.totalDays += 1;
      acc.totalWorkingHours += Number(record.workingHours || 0);
      if (record.status === "Present") acc.present += 1;
      else if (record.status === "Late") acc.late += 1;
      else if (record.status === "Half Day") acc.halfDay += 1;
      else if (record.status === "Leave") acc.leave += 1;
      else if (record.status === "Week Off") acc.weekOff += 1;
      else acc.absent += 1;
      return acc;
    },
    {
      totalDays: 0,
      present: 0,
      absent: 0,
      late: 0,
      halfDay: 0,
      leave: 0,
      weekOff: 0,
      totalWorkingHours: 0,
      attendancePercentage: 0
    }
  );

  const workingDays = Math.max(summary.totalDays - summary.weekOff, 0);
  const weightedPresent = summary.present + summary.late + summary.halfDay * 0.5;
  summary.totalWorkingHours = Math.round(summary.totalWorkingHours * 100) / 100;
  summary.attendancePercentage = workingDays ? Math.round((weightedPresent / workingDays) * 100) : 0;

  return summary;
};

const buildEmployeeReport = ({ employee, attendance, leaves, from, to, generatedBy }) => {
  const records = buildDailyRecords({ employee, attendance, leaves, from, to });
  return {
    type: "employee",
    title: "Employee Attendance Report",
    generatedAt: new Date().toISOString(),
    generatedBy,
    from,
    to,
    employee,
    summary: summarizeRecords(records),
    records
  };
};

const buildMonthlyReport = ({ employees, attendance, leaves, month, year, generatedBy }) => {
  const monthIndex = Number(month) - 1;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(Number(year), monthIndex + 1, 0);
  const to = formatDateKey(toDate);

  const rows = employees.map((employee) => {
    const employeeAttendance = attendance.filter((record) => record.employeeId === employee.employeeId);
    const employeeLeaves = leaves.filter(
      (leave) => String(leave.employee) === String(employee._id) || String(leave.employeeId) === String(employee.employeeId)
    );
    const records = buildDailyRecords({
      employee,
      attendance: employeeAttendance,
      leaves: employeeLeaves,
      from,
      to
    });
    return {
      employee,
      summary: summarizeRecords(records),
      dailyStatuses: records.map((record) => ({ date: record.date, status: record.status, code: record.statusCode })),
      records
    };
  });

  return {
    type: "monthly",
    title: "Monthly Attendance Report",
    generatedAt: new Date().toISOString(),
    generatedBy,
    month,
    year,
    from,
    to,
    rows,
    summary: rows.reduce(
      (acc, row) => {
        acc.totalEmployees += 1;
        acc.present += row.summary.present;
        acc.absent += row.summary.absent;
        acc.late += row.summary.late;
        acc.halfDay += row.summary.halfDay;
        acc.leave += row.summary.leave;
        acc.weekOff += row.summary.weekOff;
        acc.totalWorkingHours += row.summary.totalWorkingHours;
        return acc;
      },
      {
        totalEmployees: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        leave: 0,
        weekOff: 0,
        totalWorkingHours: 0
      }
    )
  };
};

const buildDepartmentReport = ({ department, employees, attendance, leaves, from, to, generatedBy }) => {
  const monthlyLike = buildMonthlyReport({
    employees,
    attendance,
    leaves,
    month: new Date(from).getMonth() + 1,
    year: new Date(from).getFullYear(),
    generatedBy
  });

  const rows = employees.map((employee) => {
    const employeeAttendance = attendance.filter((record) => record.employeeId === employee.employeeId);
    const employeeLeaves = leaves.filter(
      (leave) => String(leave.employee) === String(employee._id) || String(leave.employeeId) === String(employee.employeeId)
    );
    const records = buildDailyRecords({ employee, attendance: employeeAttendance, leaves: employeeLeaves, from, to });
    return {
      employee,
      summary: summarizeRecords(records),
      records
    };
  });

  return {
    ...monthlyLike,
    type: "department",
    title: "Department Attendance Report",
    department,
    from,
    to,
    rows,
    summary: rows.reduce(
      (acc, row) => {
        acc.totalEmployees += 1;
        acc.present += row.summary.present;
        acc.absent += row.summary.absent;
        acc.late += row.summary.late;
        acc.halfDay += row.summary.halfDay;
        acc.leave += row.summary.leave;
        acc.weekOff += row.summary.weekOff;
        acc.totalWorkingHours += row.summary.totalWorkingHours;
        return acc;
      },
      {
        totalEmployees: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        leave: 0,
        weekOff: 0,
        totalWorkingHours: 0
      }
    )
  };
};

const drawHeader = (doc, report) => {
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 48, 34, { width: 54, height: 54, fit: [54, 54] });
  }

  doc
    .fontSize(16)
    .fillColor("#0f172a")
    .font("Helvetica-Bold")
    .text("Razk Automation Employee Management System", 112, 36);
  doc.fontSize(12).fillColor("#1d4ed8").text(report.title, 112, 58);
  doc
    .fontSize(8)
    .fillColor("#475569")
    .text(`Generated on: ${formatDateTime(report.generatedAt)}`, 112, 77)
    .text(`Generated by: ${report.generatedBy?.name || "-"} (${report.generatedBy?.role || "-"})`, 112, 90);
  doc.moveTo(48, 105).lineTo(548, 105).strokeColor("#dbeafe").stroke();
};

const drawKeyValueGrid = (doc, title, rows, y) => {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(title, 48, y);
  let cursorY = y + 18;
  rows.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 48 : 300;
    if (index > 0 && index % 2 === 0) cursorY += 18;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#475569").text(`${label}:`, x, cursorY);
    doc.font("Helvetica").fontSize(8).fillColor("#0f172a").text(String(value || "-"), x + 86, cursorY);
  });
  return cursorY + 26;
};

const drawSummary = (doc, summary, y) =>
  drawKeyValueGrid(
    doc,
    "Attendance Summary",
    [
      ["Present", summary.present],
      ["Absent", summary.absent],
      ["Late", summary.late],
      ["Half Day", summary.halfDay],
      ["Leave", summary.leave],
      ["Week Off", summary.weekOff],
      ["Working Hours", summary.totalWorkingHours],
      ["Attendance %", `${summary.attendancePercentage ?? "-"}%`]
    ],
    y
  );

const drawTable = (doc, columns, rows, y, report) => {
  const widths = columns.map((column) => column.width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const drawColumnHeaders = (startY) => {
    doc.font("Helvetica-Bold").fontSize(7);
    const headerHeight = Math.max(
      20,
      ...columns.map((column, index) =>
        doc.heightOfString(column.label, { width: widths[index] - 8 }) + 10
      )
    );
    let cursorX = 48;
    doc.rect(48, startY, totalWidth, headerHeight).fill("#eff6ff");
    columns.forEach((column, index) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#1e40af")
        .text(column.label, cursorX + 4, startY + 5, { width: widths[index] - 8 });
      cursorX += widths[index];
    });
    return startY + headerHeight;
  };

  let cursorY = y;
  if (cursorY + 40 >= 730) {
    doc.addPage();
    drawHeader(doc, report);
    cursorY = 124;
  }
  cursorY = drawColumnHeaders(cursorY);

  rows.forEach((row, rowIndex) => {
    doc.font("Helvetica").fontSize(7);
    const values = columns.map((column) => String(row[column.key] ?? "-"));
    const rowHeight = Math.max(
      20,
      ...values.map((value, index) =>
        doc.heightOfString(value, { width: widths[index] - 8 }) + 10
      )
    );

    if (cursorY + rowHeight >= 730) {
      doc.addPage();
      drawHeader(doc, report);
      cursorY = drawColumnHeaders(124);
    }

    let cursorX = 48;
    if (rowIndex % 2 === 0) doc.rect(48, cursorY, totalWidth, rowHeight).fill("#f8fafc");
    columns.forEach((column, index) => {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#0f172a")
        .text(values[index], cursorX + 4, cursorY + 5, { width: widths[index] - 8 });
      cursorX += widths[index];
    });
    cursorY += rowHeight;
  });

  return cursorY + 16;
};

const drawSignatures = (doc) => {
  const y = 710;
  doc.moveTo(58, y).lineTo(188, y).strokeColor("#94a3b8").stroke();
  doc.moveTo(232, y).lineTo(362, y).strokeColor("#94a3b8").stroke();
  doc.moveTo(406, y).lineTo(536, y).strokeColor("#94a3b8").stroke();
  doc.fontSize(8).fillColor("#475569");
  doc.text("Prepared by", 88, y + 8);
  doc.text("HR Manager Signature", 248, y + 8);
  doc.text("Authorized Signature", 426, y + 8);
};

const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor("#64748b").text(`Page ${i + 1} of ${range.count}`, 500, 760);
  }
};

const renderEmployeePdf = (doc, report) => {
  drawHeader(doc, report);
  let y = 124;
  y = drawKeyValueGrid(
    doc,
    "Employee Details",
    [
      ["Employee ID", report.employee.employeeId],
      ["Name", report.employee.name],
      ["Department", report.employee.department],
      ["Designation", report.employee.designation],
      ["Week Off", normalizeWeekOffDay(report.employee.weeklyWeekOffDay)],
      ["Joining Date", report.employee.joiningDate ? formatDate(report.employee.joiningDate) : "-"],
      ["Date Range", `${formatDate(report.from)} to ${formatDate(report.to)}`]
    ],
    y
  );
  y = drawSummary(doc, report.summary, y);
  drawTable(
    doc,
    [
      { key: "date", label: "Date", width: 56 },
      { key: "day", label: "Day", width: 26 },
      { key: "checkInText", label: "Check-in", width: 48 },
      { key: "checkOutText", label: "Check-out", width: 48 },
      { key: "shiftName", label: "Shift", width: 48 },
      { key: "attendanceSite", label: "Site", width: 42 },
      { key: "workingHours", label: "Hrs", width: 26 },
      { key: "status", label: "Status", width: 42 },
      { key: "checkInGps", label: "In GPS", width: 46 },
      { key: "checkOutGps", label: "Out GPS", width: 46 },
      { key: "remarks", label: "Remarks", width: 72 }
    ],
    report.records.map((record) => ({
      ...record,
      date: formatDate(record.date),
      attendanceSite: record.attendanceSite || "-",
      checkInText: formatTime(record.checkIn),
      checkOutText: formatTime(record.checkOut),
      checkInGps: record.checkInLatitude !== "" ? `${record.checkInLatitude}, ${record.checkInLongitude}` : record.checkInLocationStatus,
      checkOutGps: record.checkOutLatitude !== "" ? `${record.checkOutLatitude}, ${record.checkOutLongitude}` : record.checkOutLocationStatus
    })),
    y,
    report
  );
  drawSignatures(doc);
};

const renderSummaryPdf = (doc, report) => {
  drawHeader(doc, report);
  let y = 124;
  y = drawKeyValueGrid(
    doc,
    "Report Details",
    [
      ["Report Type", report.type],
      ["Date Range", `${formatDate(report.from)} to ${formatDate(report.to)}`],
      ["Department", report.department || "All"],
      ["Employees", report.rows.length]
    ],
    y,
    report
  );
  drawTable(
    doc,
    [
      { key: "serial", label: "S.No", width: 24 },
      { key: "employeeId", label: "Employee ID", width: 56 },
      { key: "name", label: "Employee Name", width: 90 },
      { key: "department", label: "Department", width: 65 },
      { key: "designation", label: "Designation", width: 65 },
      { key: "present", label: "P", width: 22 },
      { key: "absent", label: "A", width: 22 },
      { key: "late", label: "L", width: 22 },
      { key: "halfDay", label: "HD", width: 24 },
      { key: "leave", label: "LV", width: 24 },
      { key: "weekOff", label: "WO", width: 24 },
      { key: "totalWorkingHours", label: "Hours", width: 32 },
      { key: "attendancePercentage", label: "%", width: 30 }
    ],
    report.rows.map((row, index) => ({
      serial: index + 1,
      employeeId: row.employee.employeeId,
      name: row.employee.name,
      department: row.employee.department,
      designation: row.employee.designation,
      present: row.summary.present,
      absent: row.summary.absent,
      late: row.summary.late,
      halfDay: row.summary.halfDay,
      leave: row.summary.leave,
      weekOff: row.summary.weekOff,
      totalWorkingHours: row.summary.totalWorkingHours,
      attendancePercentage: row.summary.attendancePercentage
    })),
    y
  );
  doc.fontSize(8).fillColor("#475569").text("Legend: P - Present | A - Absent | L - Late | HD - Half Day | LV - Leave | WO - Week Off", 48, 680);
  drawSignatures(doc);
};

const sendReportPdf = (res, report, filename) => {
  const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  if (report.type === "employee") renderEmployeePdf(doc, report);
  else renderSummaryPdf(doc, report);

  addPageNumbers(doc);
  doc.end();
};

module.exports = {
  buildDepartmentReport,
  buildEmployeeReport,
  buildMonthlyReport,
  enumerateDates,
  formatDateKey,
  sendReportPdf
};
