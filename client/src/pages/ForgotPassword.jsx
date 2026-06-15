import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Button from "../components/Button";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setResetToken(data.resetToken || "");
      toast.success(data.message);
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
        <h1 className="text-2xl font-black text-slate-950">Forgot Password</h1>
        <label className="mt-6 block space-y-1">
          <span className="form-label">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="form-input pl-9" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </label>
        <Button className="mt-5 w-full" disabled={loading} type="submit">
          {loading ? "Generating..." : "Generate Reset Token"}
        </Button>
        {resetToken ? (
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-950">
            Reset token: {resetToken}
          </div>
        ) : null}
      </form>
    </main>
  );
}
