import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Loading from "./components/Loading";
import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./layouts/ProtectedRoute";

const AddEmployee = lazy(() => import("./pages/AddEmployee"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const AttendanceReports = lazy(() => import("./pages/AttendanceReports"));
const DRIRequests = lazy(() => import("./pages/DRIRequests"));
const EditEmployee = lazy(() => import("./pages/EditEmployee"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmployeeProfile = lazy(() => import("./pages/EmployeeProfile"));
const EmployeesList = lazy(() => import("./pages/EmployeesList"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const HRDashboard = lazy(() => import("./pages/HRDashboard"));
const LeaveRequests = lazy(() => import("./pages/LeaveRequests"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ODRequests = lazy(() => import("./pages/ODRequests"));
const PermissionRequests = lazy(() => import("./pages/PermissionRequests"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Settings = lazy(() => import("./pages/Settings"));
const VisitorVisits = lazy(() => import("./pages/VisitorVisits"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
