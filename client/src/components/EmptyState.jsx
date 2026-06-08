import { Inbox } from "lucide-react";

export default function EmptyState({ title = "No records found", body = "New activity will appear here." }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center dark:border-[#24456f] dark:bg-[#09192e]">
      <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-[#0c1f3d] dark:text-blue-300 dark:ring-[#24456f]">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-700 dark:text-blue-100">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-blue-200">{body}</p>
    </div>
  );
}
