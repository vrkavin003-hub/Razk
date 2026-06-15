const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { query } = require("../db");
const toCsv = require("../../utils/csv");
const { optionalDate } = require("../utils/validation");

const logoPath = path.join(__dirname, "..", "..", "assets", "razk-logo.jpeg");

const reportDefinitions = {
  "contact-messages": {
    title: "Contact Messages Report",
    sql: `SELECT id, name, email, phone, company, subject, status, created_at FROM contact_messages`,
    columns: ["id", "name", "email", "phone", "company", "subject", "status", "created_at"],
    dateColumn: "created_at"
  },
  "career-applications": {
    title: "Career Applications Report",
    sql: `SELECT id, full_name, email, phone, position, experience, qualification, status, created_at FROM career_applications`,
    columns: ["id", "full_name", "email", "phone", "position", "experience", "qualification", "status", "created_at"],
    dateColumn: "created_at"
  },
  attendance: {
    title: "Location Attendance Report",
    sql: `SELECT id, employee_id, date, check_in_time, check_out_time, shift_name,
                 check_in_latitude, check_in_longitude, check_in_accuracy, check_in_location_status,
                 check_out_latitude, check_out_longitude, check_out_accuracy, check_out_location_status,
                 work_duration, status, created_at
          FROM attendance`,
    columns: [
      "id",
      "employee_id",
      "date",
      "check_in_time",
      "check_out_time",
      "shift_name",
      "check_in_latitude",
      "check_in_longitude",
      "check_in_accuracy",
      "check_in_location_status",
      "check_out_latitude",
      "check_out_longitude",
      "check_out_accuracy",
      "check_out_location_status",
      "work_duration",
      "status"
    ],
    dateColumn: "date"
  }
};

const dateRangeForPeriod = (period) => {
  const now = new Date();
  if (period === "weekly") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return [from.toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
  }
  if (period === "monthly") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return [from.toISOString().slice(0, 10), now.toISOString().slice(0, 10)];
  }
  return ["", ""];
};

const buildReportQuery = (definition, reqQuery = {}) => {
  const where = [];
  const params = {};
  const periodRange = dateRangeForPeriod(reqQuery.period);
  const from = optionalDate(reqQuery.from) || periodRange[0];
  const to = optionalDate(reqQuery.to) || periodRange[1];

  if (from) {
    where.push(`DATE(${definition.dateColumn}) >= :from`);
    params.from = from;
  }
  if (to) {
    where.push(`DATE(${definition.dateColumn}) <= :to`);
    params.to = to;
  }
  if (reqQuery.status) {
    where.push("status = :status");
    params.status = reqQuery.status;
  }

  return {
    params,
    sql: `${definition.sql} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${definition.dateColumn} DESC`
  };
};

const writeAuditExport = async (req, reportType, format) => {
  await query(
    `INSERT INTO report_exports (user_id, report_type, format, filters)
     VALUES (:userId, :reportType, :format, :filters)`,
    {
      filters: JSON.stringify(req.query || {}),
      format,
      reportType,
      userId: req.user?.id || null
    }
  );
};

const sendCsv = (res, definition, rows) => {
  const csv = toCsv([definition.columns, ...rows.map((row) => definition.columns.map((column) => row[column] ?? ""))]);
  res.header("Content-Type", "text/csv");
  res.attachment(`${definition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`);
  res.send(csv);
};

const sendExcel = async (res, definition, rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Razk Automation";
  const sheet = workbook.addWorksheet(definition.title);
  sheet.addRow(definition.columns.map((column) => column.replace(/_/g, " ").toUpperCase()));
  rows.forEach((row) => sheet.addRow(definition.columns.map((column) => row[column] ?? "")));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });
  res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.attachment(`${definition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
};

const sendPdf = (res, definition, rows) => {
  const doc = new PDFDocument({ margin: 42, size: "A4" });
  res.header("Content-Type", "application/pdf");
  res.attachment(`${definition.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
  doc.pipe(res);

  if (fs.existsSync(logoPath)) doc.image(logoPath, 42, 32, { width: 48 });
  doc.fontSize(18).font("Helvetica-Bold").text("Razk Automation", 100, 36);
  doc.fontSize(11).font("Helvetica").fillColor("#475569").text("Enterprise Operations Report", 100, 60);
  doc.fillColor("#0f172a").fontSize(15).font("Helvetica-Bold").text(definition.title, 42, 105);
  doc.fontSize(9).font("Helvetica").fillColor("#64748b").text(`Generated: ${new Date().toLocaleString("en-IN")}`, 42, 126);

  let y = 155;
  const usableWidth = 512;
  const colWidth = Math.max(68, Math.floor(usableWidth / Math.min(definition.columns.length, 7)));
  const visibleColumns = definition.columns.slice(0, Math.floor(usableWidth / colWidth));

  doc.fontSize(8).font("Helvetica-Bold").fillColor("#0f172a");
  visibleColumns.forEach((column, index) => {
    doc.text(column.replace(/_/g, " ").toUpperCase(), 42 + index * colWidth, y, { width: colWidth - 4 });
  });
  y += 18;
  doc.moveTo(42, y - 4).lineTo(554, y - 4).strokeColor("#e2e8f0").stroke();

  doc.font("Helvetica").fontSize(8).fillColor("#334155");
  rows.forEach((row, rowIndex) => {
    if (y > 742) {
      doc.fontSize(8).fillColor("#94a3b8").text(`Page ${doc.bufferedPageRange().count + 1}`, 42, 780);
      doc.addPage();
      y = 48;
    }
    visibleColumns.forEach((column, index) => {
      doc.text(String(row[column] ?? "-").slice(0, 42), 42 + index * colWidth, y, { width: colWidth - 4 });
    });
    y += rowIndex % 2 === 0 ? 20 : 18;
  });

  doc.fontSize(8).fillColor("#94a3b8").text("Razk Automation | Confidential", 42, 780);
  doc.end();
};

const exportReport = async (req, res, next) => {
  try {
    const type = req.params.type;
    const format = req.query.format || "pdf";
    const definition = reportDefinitions[type];
    if (!definition) {
      res.status(404).json({ message: "Report type not found" });
      return;
    }
    const reportQuery = buildReportQuery(definition, req.query);
    const rows = await query(reportQuery.sql, reportQuery.params);
    await writeAuditExport(req, type, format);

    if (format === "csv") return sendCsv(res, definition, rows);
    if (format === "excel" || format === "xlsx") return sendExcel(res, definition, rows);
    return sendPdf(res, definition, rows);
  } catch (error) {
    next(error);
  }
};

const exportPeriodReport = (period) => (req, res, next) => {
  req.query.period = period;
  return exportReport(req, res, next);
};

module.exports = {
  exportPeriodReport,
  exportReport
};
