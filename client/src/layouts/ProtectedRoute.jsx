import { Navigate, Outlet, useLocation } from "react-router-dom";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole, roleMatches } from "../utils/formatters";

export default function ProtectedRoute({ roles }) {
  const { authReady, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4">
        <Loading label="Checking secure session" />
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roleMatches(user?.role, roles)) {
    return <Navigate to={dashboardPathForRole(user?.role)} replace />;
  }

  return <Outlet />;
}
