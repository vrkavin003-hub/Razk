export default function StatCard({ label, value, icon: Icon, tone = "blue", detail }) {
  const tones = {
    blue: {
      icon: "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
      bar: "bg-sky-700"
    },
    green: {
      icon: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
      bar: "bg-emerald-700"
    },
    amber: {
      icon: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
      bar: "bg-amber-700"
    },
    rose: {
      icon: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
      bar: "bg-rose-700"
    },
    slate: {
      icon: "bg-slate-100 text-slate-900 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
      bar: "bg-slate-900"
    }
  };
  const toneStyle = tones[tone] || tones.blue;

  return (
    <div className="panel relative overflow-hidden p-5">
      <span className={`absolute inset-x-0 top-0 h-1 ${toneStyle.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-500 dark:text-slate-300">{label}</p>
          <p className="mt-2 break-words text-3xl font-black tracking-normal text-slate-950 dark:text-slate-100">{value ?? 0}</p>
        </div>
        {Icon ? (
          <span className={`rounded-lg p-3 ring-1 ${toneStyle.icon}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {detail ? <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-300">{detail}</p> : null}
    </div>
  );
}
