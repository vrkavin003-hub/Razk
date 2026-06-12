import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./layouts/ProtectedRoute";
import AddEmployee from "./pages/AddEmployee";
import AdminDashboard from "./pages/AdminDashboard";
import Announcements from "./pages/Announcements";
import AttendancePage from "./pages/AttendancePage";
import AttendanceReports from "./pages/AttendanceReports";
import EditEmployee from "./pages/EditEmployee";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeProfile from "./pages/EmployeeProfile";
import EmployeesList from "./pages/EmployeesList";
import ForgotPassword from "./pages/ForgotPassword";
import HRDashboard from "./pages/HRDashboard";
import DRIRequests from "./pages/DRIRequests";
import LeaveRequests from "./pages/LeaveRequests";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import ODRequests from "./pages/ODRequests";
import PermissionRequests from "./pages/PermissionRequests";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import VisitorVisits from "./pages/VisitorVisits";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/employee" replace />} />
            <Route element={<ProtectedRoute roles={["admin"]} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
            <Route element={<ProtectedRoute roles={["hr"]} />}>
              <Route path="/hr" element={<HRDashboard />} />
            </Route>
            <Route element={<ProtectedRoute roles={["employee"]} />}>
              <Route path="/employee" element={<EmployeeDashboard />} />
            </Route>
            <Route element={<ProtectedRoute roles={["dri"]} />}>
              <Route path="/dri" element={<EmployeeDashboard title="DRI Dashboard" />} />
              <Route path="/dri/assigned-requests" element={<DRIRequests mode="assigned" />} />
              <Route path="/dri/my-requests" element={<DRIRequests mode="my" />} />
            </Route>
            <Route element={<ProtectedRoute roles={["admin", "hr"]} />}>
              <Route path="/employees" element={<EmployeesList />} />
              <Route path="/employees/new" element={<AddEmployee />} />
              <Route path="/employees/:id/edit" element={<EditEmployee />} />
              <Route path="/attendance/reports" element={<AttendanceReports />} />
            </Route>
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/leave" element={<LeaveRequests />} />
            <Route path="/permission" element={<PermissionRequests />} />
            <Route path="/od" element={<ODRequests />} />
            <Route element={<ProtectedRoute roles={["admin", "hr"]} />}>
              <Route path="/visitors" element={<VisitorVisits />} />
            </Route>
            <Route element={<ProtectedRoute roles={["admin", "hr", "employee"]} />}>
              <Route path="/announcements" element={<Announcements />} />
            </Route>
            <Route path="/profile" element={<EmployeeProfile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
