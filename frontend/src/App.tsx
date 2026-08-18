// frontend/src/App.tsx
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { StaffListPage } from './pages/StaffListPage';
import { StaffEditPage } from './pages/StaffEditPage';
import { GroupListPage } from './pages/GroupListPage';
import { GroupDetailPage } from './pages/GroupDetailPage';
import { ShiftTemplateListPage } from './pages/ShiftTemplateListPage';
import { RosterCreatePage } from './pages/RosterCreatePage';
import { RosterListPage } from './pages/RosterListPage';
import { RosterDetailPage } from './pages/RosterDetailPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          path="/rosters/:id"
          element={
            <ProtectedRoute>
              <RosterDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </AuthProvider>
  );
}
