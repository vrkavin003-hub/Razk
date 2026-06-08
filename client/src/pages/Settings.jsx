import { Database, KeyRound, Server, Shield } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../services/api";

export default function Settings() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader title="Settings" description="Application environment and account context." />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Role" value={user?.role?.toUpperCase()} icon={Shield} tone="blue" />
        <StatCard label="Department" value={user?.department || "HYA Tech"} icon={Database} tone="slate" />
        <StatCard label="Auth" value="JWT" icon={KeyRound} tone="green" />
        <StatCard label="API" value="Online" icon={Server} tone="amber" />
      </section>
      <section className="mt-6 panel p-5">
        <h2 className="text-base font-bold text-slate-950">Runtime</h2>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-500">API Base URL</dt>
            <dd className="mt-2 break-all text-sm font-semibold text-slate-900">{API_BASE_URL}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase text-slate-500">Default Admin</dt>
            <dd className="mt-2 text-sm font-semibold text-slate-900">admin@hyatech.com</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
