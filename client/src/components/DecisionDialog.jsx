import { useEffect, useState } from "react";
import Button from "./Button";

export default function DecisionDialog({
  actionLabel = "Confirm",
  body,
  loading = false,
  onClose,
  onSubmit,
  open,
  title,
  variant = "primary"
}) {
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (open) setRemarks("");
  }, [open]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    onSubmit(remarks);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm dark:bg-slate-950/70"
        onClick={onClose}
        type="button"
      />
      <form
        aria-modal="true"
        className="panel relative w-full max-w-lg p-5"
        onSubmit={submit}
        role="dialog"
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Decision</p>
          <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-slate-100">{title}</h2>
          {body ? <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">{body}</p> : null}
        </div>
        <label className="mt-5 block space-y-1.5">
          <span className="form-label">Remarks</span>
          <textarea
            autoFocus
            className="form-input min-h-28"
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Add a short note for the employee"
            value={remarks}
          />
        </label>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button disabled={loading} onClick={onClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={loading} type="submit" variant={variant}>
            {loading ? "Saving..." : actionLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
