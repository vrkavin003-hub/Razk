import {
  Activity,
  BarChart3,
  Bell,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import CompanyLogo from "../components/CompanyLogo";
import NotificationBell from "../components/NotificationBell";
import ThemeToggle from "../components/ThemeToggle";
import TopBarClock from "../components/TopBarClock";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { initials, roleMatches } from "../utils/formatters";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, roles: ["admin"], section: "Overview" },
  { label: "Dashboard", path: "/hr", icon: LayoutDashboard, roles: ["hr"], section: "Overview" },
  { label: "Dashboard", path: "/employee", icon: LayoutDashboard, roles: ["employee"], section: "Overview" },
  { label: "Employees", path: "/employees", icon: Users, roles: ["admin", "hr"], section: "People" },
  { label: "Add Employee", path: "/employees/new", icon: UserPlus, roles: ["admin", "hr"], section: "People" },
  { label: "Attendance", path: "/attendance", icon: CalendarCheck, roles: ["admin", "hr", "employee"], section: "Operations" },
  { label: "Reports", path: "/attendance/reports", icon: BarChart3, roles: ["admin", "hr"], section: "Operations" },
  { label: "Leave", path: "/leave", icon: FileText, roles: ["admin", "hr", "employee"], section: "Requests" },
  { label: "Permission", path: "/permission", icon: ClipboardList, roles: ["admin", "hr", "employee"], section: "Requests" },
  { label: "Announcements", path: "/announcements", icon: Bell, roles: ["admin", "hr", "employee"], section: "Comms" },
  { label: "Profile", path: "/profile", icon: ShieldCheck, roles: ["admin", "hr", "employee"], section: "Account" },
  { label: "Settings", path: "/settings", icon: Settings, roles: ["admin", "hr", "employee"], section: "Account" }
];

const navSections = ["Overview", "People", "Operations", "Requests", "Comms", "Account"];

const initialTheme = () => {
  try {
    return localStorage.getItem("hya_theme") || "light";
  } catch {
    return "light";
  }
};

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [counts, setCounts] = useState({
    pendingLeaveCount: 0,
    pendingPermissionCount: 0,
    leaveUpdateCount: 0,
    permissionUpdateCount: 0
  });

  const items = navItems.filter((item) => roleMatches(user?.role, item.roles));
  const activeItem = [...items]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const roleLabel = user?.role ? user.role.toUpperCase() : "USER";
  const groupedItems = navSections
    .map((section) => [section, items.filter((item) => item.section === section)])
    .filter(([, sectionItems]) => sectionItems.length);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
    localStorage.setItem("hya_theme", theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    const loadCounts = async () => {
      try {
        const { data } = await api.get("/notifications/counts");
        if (isMounted) setCounts(data);
      } catch {
        if (isMounted) {
          setCounts({
            pendingLeaveCount: 0,
            pendingPermissionCount: 0,
            leaveUpdateCount: 0,
            permissionUpdateCount: 0
          });
        }
      }
    };

    loadCounts();
    const timer = window.setInterval(loadCounts, 15000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  const menuBadge = (path) => {
    if (path === "/leave") {
      return roleMatches(user?.role, ["admin", "hr"]) ? counts.pendingLeaveCount : counts.leaveUpdateCount;
    }
    if (path === "/permission") {
      return roleMatches(user?.role, ["admin", "hr"])
        ? counts.pendingPermissionCount
        : counts.permissionUpdateCount;
    }
    return 0;
  };

  const menuLabel = (item) => {
    if (item.path === "/leave") return roleMatches(user?.role, ["admin", "hr"]) ? "Leave Requests" : "My Leave";
    if (item.path === "/permission") {
      return roleMatches(user?.role, ["admin", "hr"]) ? "Permission Requests" : "My Permission";
    }
    return item.label;
  };
  const currentLabel = activeItem ? menuLabel(activeItem) : "Workspace";

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-slate-200 bg-white/95 backdrop-blur dark:border-[#203e6f] dark:bg-[#09192e]">
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-5 dark:border-[#203e6f]">
        <CompanyLogo />
        <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800">
          Live
        </span>
      </div>
      <nav className="thin-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {groupedItems.map(([section, sectionItems]) => (
          <div className="mb-5 last:mb-0" key={section}>
            <p className="mb-2 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-blue-300">
              {section}
            </p>
            <div className="space-y-1">
              {sectionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    className={({ isActive }) =>
                      `group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition duration-200 ${
                        isActive
                          ? "bg-hya-50 text-hya-700 ring-1 ring-hya-100 dark:bg-[#123b66] dark:text-blue-50 dark:ring-[#24456f]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-blue-200 dark:hover:bg-[#123052] dark:hover:text-blue-50"
                      }`
                    }
                    key={`${item.path}-${item.label}`}
                    onClick={() => setOpen(false)}
                    to={item.path}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 transition group-hover:text-hya-700 dark:bg-[#0c1f3d] dark:text-blue-200 dark:ring-[#24456f]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{menuLabel(item)}</span>
                    {menuBadge(item.path) ? (
                      <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-black text-white dark:bg-amber-400 dark:text-blue-950">
                        {menuBadge(item.path) > 9 ? "9+" : menuBadge(item.path)}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-4 dark:border-[#203e6f]">
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-[#24456f] dark:bg-[#0c1f3d]">
          <div className="mb-3 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white dark:bg-blue-500">
            {initials(user?.name)}
          </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900 dark:text-blue-50">{user?.name}</p>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-blue-200">
                {user?.department || "HYA Tech"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="rounded-full bg-white px-2.5 py-1 font-black text-slate-600 ring-1 ring-slate-200 dark:bg-[#09192e] dark:text-blue-100 dark:ring-[#24456f]">
              {roleLabel}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-200">
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              Active
            </span>
          </div>
        </div>
        <Button className="w-full" icon={LogOut} onClick={handleLogout} variant="secondary">
          Logout
        </Button>
      </div>
    </aside>
  );

  return (
    <div
      className={`theme-${theme} min-h-screen bg-[#f6f8fb] text-slate-900 dark:bg-hya-950 dark:text-blue-50`}
      data-theme={theme}
    >
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex">{sidebar}</div>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/40 dark:bg-blue-950/70"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      ) : null}
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl lg:px-8 dark:border-[#203e6f] dark:bg-[#09192e]/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="inline-grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/5 lg:hidden dark:border-[#24456f] dark:bg-[#0c1f3d] dark:text-blue-100"
              onClick={() => setOpen((current) => !current)}
              aria-label="Open menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <div className="hidden items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400 sm:flex dark:text-blue-300">
                <span>HYA Tech</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{roleLabel}</span>
              </div>
              <p className="truncate text-base font-black text-slate-950 dark:text-blue-50">{currentLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <TopBarClock />
            <NotificationBell />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-900 dark:text-blue-50">{user?.name}</p>
              <p className="text-xs text-slate-500 dark:text-blue-200">{user?.department || "HYA Tech"}</p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-hya-600 text-sm font-black text-white shadow-sm shadow-hya-600/20">
              {initials(user?.name)}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
