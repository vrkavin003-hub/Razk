export default function PageHeader({ title, description, action, eyebrow = "Workspace" }) {
  return (
    <div className="mb-6 border-b border-slate-200/80 pb-5 dark:border-[#203e6f]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-hya-600 dark:text-blue-300">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950 dark:text-blue-50 sm:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-blue-200">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
