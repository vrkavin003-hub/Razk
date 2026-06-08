import { timeAgo } from "../utils/formatters";

export default function TimeAgo({ value, className = "" }) {
  return <span className={className}>{timeAgo(value)}</span>;
}
