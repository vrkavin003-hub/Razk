import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatTopBarDateTime } from "../utils/formatters";

export default function TopBarClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/5 md:flex dark:border-[#24456f] dark:bg-[#0c1f3d] dark:text-blue-100 dark:shadow-none">
      <Clock3 className="h-4 w-4 text-hya-600 dark:text-blue-300" aria-hidden="true" />
      <span className="hidden xl:inline">{formatTopBarDateTime(now)}</span>
      <span className="xl:hidden">{formatTopBarDateTime(now, true)}</span>
    </div>
  );
}
