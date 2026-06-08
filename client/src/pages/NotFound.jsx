import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/Button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-panel">
        <p className="text-sm font-bold uppercase tracking-wider text-hya-600">404</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Page Not Found</h1>
        <p className="mt-3 text-sm text-slate-500">The requested HYA Tech page is not available.</p>
        <Link className="mt-6 inline-block" to="/login">
          <Button icon={Home}>Go Home</Button>
        </Link>
      </section>
    </main>
  );
}
