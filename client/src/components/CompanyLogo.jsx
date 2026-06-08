import hyaLogo from "../assets/hya-logo.png";

export default function CompanyLogo({ className = "", showText = true, compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="theme-logo-tile grid shrink-0 place-items-center rounded-lg p-1.5 ring-1 shadow-sm shadow-slate-900/5">
        <img
          alt="HYA Tech logo"
          className={compact ? "h-7 w-7 object-contain" : "h-10 w-10 object-contain"}
          src={hyaLogo}
        />
      </span>
      {showText ? (
        <span className="min-w-0">
          <span className="block truncate text-base font-black tracking-normal text-slate-950 dark:text-blue-50">
            HYA Tech
          </span>
          <span className="block truncate text-xs font-bold text-slate-500 dark:text-blue-200">
            Employee Management
          </span>
        </span>
      ) : null}
    </div>
  );
}
