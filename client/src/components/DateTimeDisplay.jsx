import { formatRequestTimestamp } from "../utils/formatters";

export default function DateTimeDisplay({ value, className = "" }) {
  return <span className={className}>{formatRequestTimestamp(value)}</span>;
}
