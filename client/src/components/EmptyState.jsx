import { Inbox } from "lucide-react";

export default function EmptyState({ title = "No records found", body = "New activity will appear here." }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <span className="grid h-12 w-12 place-items-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-300">{body}</p>
    </div>
  );
}
