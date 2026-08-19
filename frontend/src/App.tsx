// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { GuestRoute } from './auth/GuestRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { StaffListPage } from './pages/StaffListPage';
import { StaffCreatePage } from './pages/StaffCreatePage';
import { StaffEditPage } from './pages/StaffEditPage';
import { GroupListPage } from './pages/GroupListPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { ShiftTemplateListPage } from './pages/ShiftTemplateListPage';
import { ResponsibilityListPage } from './pages/ResponsibilityListPage';
import { RosterCreatePage } from './pages/RosterCreatePage';
import { RosterListPage } from './pages/RosterListPage';
import { RosterDetailPage } from './pages/RosterDetailPage';
import { HelpPage } from './pages/HelpPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPasswordPage />
            </GuestRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              <StaffListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/new"
          element={
            <ProtectedRoute>
              <StaffCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/:id"
          element={
            <ProtectedRoute>
              <StaffEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups"
          element={
            <ProtectedRoute>
              <GroupListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <ProtectedRoute>
              <GroupDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shift-templates"
          element={
            <ProtectedRoute>
              <ShiftTemplateListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/responsibilities"
          element={
            <ProtectedRoute>
              <ResponsibilityListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters"
          element={
            <ProtectedRoute>
              <RosterListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters/new"
          element={
            <ProtectedRoute>
              <RosterCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters/:id/edit"
          element={
            <ProtectedRoute>
              <RosterCreatePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rosters/:id"
          element={
            <ProtectedRoute>
              <RosterDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/help"
          element={
            <ProtectedRoute>
              <HelpPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}
