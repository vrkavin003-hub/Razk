import { CalendarCheck, CheckCircle2, Clock3, Eye, EyeOff, Factory, LockKeyhole, Mail, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import CompanyLogo from "../components/CompanyLogo";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole } from "../utils/formatters";

const metrics = [
  { label: "Attendance", value: "Live", icon: CalendarCheck },
  { label: "Approvals", value: "Queued", icon: CheckCircle2 },
  { label: "Field Teams", value: "Synced", icon: Users }
];

const previewRows = [
  ["Service Sites", "Present", "91%"],
  ["Panels", "Requests", "04"],
  ["Reports", "Ready", "PDF"]
];

export default function Login() {
  const { isAuthenticated, login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate(dashboardPathForRole(user?.role), { replace: true });
  }, [isAuthenticated, navigate, user?.role]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(form);
      toast.success("Login successful");
      navigate(location.state?.from?.pathname || dashboardPathForRole(loggedInUser.role), { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-mobile bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid min-h-mobile lg:grid-cols-[minmax(0,1fr)_520px]">
        <section className="mobile-safe-top relative flex min-h-[46vh] flex-col justify-between overflow-hidden bg-slate-200 px-5 py-6 text-slate-950 dark:bg-slate-900 dark:text-slate-100 sm:px-6 sm:py-8 lg:min-h-screen lg:px-12 lg:py-10">
          <div className="absolute inset-0 opacity-[0.08]">
            <div className="h-full w-full bg-[linear-gradient(120deg,rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(30deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:48px_48px]" />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CompanyLogo compact showText={false} />
                <div>
                  <p className="text-base font-black text-slate-950">Razk Automation</p>
                  <p className="text-xs font-bold text-slate-600">Employee Management</p>
                </div>
              </div>
              <span className="hidden rounded-full bg-slate-200/35 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-slate-950 ring-1 ring-slate-300/45 sm:inline-flex">
                Secure HRMS
              </span>
            </div>
          </div>

          <div className="relative my-10 max-w-3xl lg:my-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-slate-200/35 px-3 py-1.5 text-xs font-bold text-slate-950 ring-1 ring-slate-300/45">
              <Factory className="h-4 w-4" aria-hidden="true" />
              Razk Automation Operations
            </div>
            <h1 className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">Razk Automation HRMS</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
              Attendance, approvals, technician records, and reports for automation office and field teams.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {metrics.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="rounded-lg bg-slate-100 p-4 ring-1 ring-slate-200" key={item.label}>
                    <Icon className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-600">{item.label}</p>
                    <p className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 max-w-2xl rounded-lg border border-slate-200 bg-slate-100/80 p-4 shadow-2xl shadow-black/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Today Command Center</p>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Live operating snapshot</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/35 px-2.5 py-1 text-xs font-black text-slate-950 ring-1 ring-slate-300/45">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  IST
                </span>
              </div>
              <div className="space-y-2">
                {previewRows.map(([area, status, value]) => (
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg bg-slate-100 px-3 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700" key={area}>
                    <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{area}</span>
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{status}</span>
                    <span className="text-sm font-black text-slate-900 dark:text-slate-100">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-700" aria-hidden="true" />
              JWT protected
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-slate-500 sm:inline-block" />
            <span>Built for Razk Automation teams</span>
          </div>
        </section>

        <section className="mobile-safe-page flex items-center justify-center px-5 py-8 sm:px-6 lg:px-12">
          <form
            autoComplete="off"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-panel sm:p-6 dark:bg-slate-950 dark:border-slate-700"
            onSubmit={submit}
          >
            <div>
              <CompanyLogo className="mb-7" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Secure Login</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-slate-100">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Sign in with your Razk Automation email or login ID.</p>
            </div>
            <div className="mt-7 space-y-4">
              <label className="space-y-1.5">
                <span className="form-label">Email / Login ID</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    autoComplete="off"
                    className="form-input pl-10"
                    type="text"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    required
                  />
                </div>
              </label>
              <label className="space-y-1.5">
                <span className="form-label">Password</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    autoComplete="new-password"
                    className="form-input px-10"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    required
                  />
                  <button
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <Link className="text-sm font-semibold text-slate-900 hover:text-slate-700 dark:text-slate-100 dark:hover:text-slate-200" to="/forgot-password">
                Forgot password
              </Link>
            </div>
            <Button className="mt-6 w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500 ring-1 ring-slate-200">
              <span className="font-bold text-slate-700">Secure access:</span> Use your assigned Razk Automation credentials.
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
