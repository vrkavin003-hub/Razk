const variants = {
  primary:
    "bg-slate-950 text-white shadow-sm shadow-slate-900/20 hover:bg-slate-800 focus:ring-slate-200 dark:bg-slate-100 dark:text-slate-950 dark:shadow-none",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:shadow-none dark:hover:bg-slate-800 dark:focus:ring-slate-600",
  danger:
    "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 focus:ring-rose-100 dark:shadow-none",
  success:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 focus:ring-emerald-100 dark:shadow-none",
  warning:
    "bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 focus:ring-amber-100 dark:shadow-none",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:ring-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-slate-600"
};

const sizes = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2.5 text-sm",
  icon: "h-11 w-11 p-0 text-sm"
};

export default function Button({
  as: Component = "button",
  children,
  className = "",
  disabled,
  icon: Icon,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}) {
  const isIconOnly = !children;
  const isButton = Component === "button";

  return (
    <Component
      className={[
        "inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[isIconOnly ? "icon" : size] || sizes.md,
        className
      ].join(" ")}
      aria-disabled={!isButton && disabled ? "true" : undefined}
      disabled={isButton ? disabled : undefined}
      type={isButton ? type : undefined}
      {...props}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </Component>
  );
}
