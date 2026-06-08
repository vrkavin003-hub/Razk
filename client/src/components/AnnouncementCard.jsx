import { Megaphone } from "lucide-react";
import DateTimeDisplay from "./DateTimeDisplay";

export default function AnnouncementCard({ announcement }) {
  return (
    <article className="panel p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10 dark:hover:shadow-none">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-hya-50 p-3 text-hya-700 ring-1 ring-hya-100 dark:bg-[#123b66] dark:text-blue-200 dark:ring-[#24456f]">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-black text-slate-950 dark:text-blue-50">{announcement.title}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-blue-200">
            {announcement.targetRole} | <DateTimeDisplay value={announcement.createdAt} />
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-blue-100">{announcement.message}</p>
          {announcement.createdBy?.name ? (
            <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-blue-200">
              By {announcement.createdBy.name}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
