import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { dashboardPathForRole, roleMatches } from "../utils/formatters";

export default function ProtectedRoute({ roles }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles?.length && !roleMatches(user?.role, roles)) {
    return <Navigate to={dashboardPathForRole(user?.role)} replace />;
  }

  return <Outlet />;
}
