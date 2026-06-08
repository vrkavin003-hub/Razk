import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../components/Button";
import api from "../services/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = useMemo(() => params.get("token") || "", [params]);
  const [form, setForm] = useState({ token: tokenFromUrl, password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/reset-password", form);
      toast.success("Password reset successful");
      navigate("/login");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <form className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-panel" onSubmit={submit}>
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600" to="/login">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <h1 className="text-2xl font-black text-slate-950">Reset Password</h1>
        <div className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="form-label">Reset Token</span>
            <input className="form-input" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} required />
          </label>
          <label className="block space-y-1">
            <span className="form-label">New Password</span>
            <input
              className="form-input"
              minLength={6}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
        </div>
        <Button className="mt-5 w-full" disabled={loading} type="submit">
          {loading ? "Saving..." : "Reset Password"}
        </Button>
      </form>
    </main>
  );
}
