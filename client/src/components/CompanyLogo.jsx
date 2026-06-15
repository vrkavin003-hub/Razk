import razkLogo from "../assets/razk-logo.jpeg";

export default function CompanyLogo({ className = "", showText = true, compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="theme-logo-tile grid shrink-0 place-items-center rounded-lg p-1.5 ring-1 shadow-sm shadow-slate-900/5">
        <img
          alt="Razk Automation logo"
          className={compact ? "h-7 w-7 object-contain" : "h-10 w-10 object-contain"}
          src={razkLogo}
        />
      </span>
      {showText ? (
        <span className="min-w-0">
          <span className="block truncate text-base font-black tracking-normal text-slate-950 dark:text-slate-100">
            Razk Automation
          </span>
          <span className="block truncate text-xs font-bold text-slate-500 dark:text-slate-300">
            Employee Management
          </span>
        </span>
      ) : null}
    </div>
  );
}
