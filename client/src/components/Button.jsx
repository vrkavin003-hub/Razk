const variants = {
  primary:
    "bg-hya-600 text-white shadow-sm shadow-hya-600/20 hover:bg-hya-700 focus:ring-hya-100 dark:bg-blue-100 dark:text-hya-950 dark:shadow-none dark:hover:bg-white dark:focus:ring-[#24456f]",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 hover:border-hya-100 hover:bg-hya-50 hover:text-hya-700 focus:ring-hya-100 dark:border-[#203e6f] dark:bg-[#0c1f3d] dark:text-blue-100 dark:shadow-none dark:hover:bg-[#173b62] dark:focus:ring-[#24456f]",
  danger:
    "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-700 focus:ring-rose-100 dark:shadow-none",
  success:
    "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 focus:ring-emerald-100 dark:shadow-none",
  warning:
    "bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 focus:ring-amber-100 dark:shadow-none",
  ghost:
    "text-slate-600 hover:bg-hya-50 hover:text-hya-700 focus:ring-hya-100 dark:text-blue-100 dark:hover:bg-[#173b62] dark:hover:text-white dark:focus:ring-[#24456f]"
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
