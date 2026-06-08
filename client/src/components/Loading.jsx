import CompanyLogo from "./CompanyLogo";

export default function Loading({ label = "Loading" }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg">
      <CompanyLogo showText={false} />
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-hya-600 dark:border-[#203e6f] dark:border-t-blue-300" />
      <p className="text-sm font-semibold text-slate-500 dark:text-blue-200">{label}</p>
      <span className="sr-only">{label}</span>
    </div>
  );
}
