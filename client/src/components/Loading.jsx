import CompanyLogo from "./CompanyLogo";

export default function Loading({ label = "Loading" }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg">
      <CompanyLogo showText={false} />
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-100" />
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-300">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
