export default function StatCard({ label, value, icon: Icon, tone = "blue", detail }) {
  const tones = {
    blue: {
      icon: "bg-hya-50 text-hya-700 ring-hya-100 dark:bg-[#123052] dark:text-blue-100 dark:ring-[#24456f]",
      bar: "bg-hya-600"
    },
    green: {
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800",
      bar: "bg-emerald-500 dark:bg-emerald-600"
    },
    amber: {
      icon: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800",
      bar: "bg-amber-500"
    },
    rose: {
      icon: "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800",
      bar: "bg-rose-600"
    },
    slate: {
      icon: "bg-slate-100 text-slate-900 ring-slate-200 dark:bg-[#123052] dark:text-blue-100 dark:ring-[#24456f]",
      bar: "bg-hya-900"
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
