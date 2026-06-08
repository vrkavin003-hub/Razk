const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const toCsv = (rows) => rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

module.exports = toCsv;
