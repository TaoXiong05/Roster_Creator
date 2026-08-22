// frontend/src/App.tsx
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { GuestRoute } from './auth/GuestRoute';
import { Spinner } from './components/Spinner';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StaffListPage = lazy(() => import('./pages/StaffListPage').then((m) => ({ default: m.StaffListPage })));
const StaffCreatePage = lazy(() =>
  import('./pages/StaffCreatePage').then((m) => ({ default: m.StaffCreatePage }))
);
const StaffEditPage = lazy(() => import('./pages/StaffEditPage').then((m) => ({ default: m.StaffEditPage })));
const GroupListPage = lazy(() => import('./pages/GroupListPage').then((m) => ({ default: m.GroupListPage })));
const GroupDetailPage = lazy(() =>
  import('./pages/GroupDetailPage').then((m) => ({ default: m.GroupDetailPage }))
);
const ShiftTemplateListPage = lazy(() =>
  import('./pages/ShiftTemplateListPage').then((m) => ({ default: m.ShiftTemplateListPage }))
);
const ResponsibilityListPage = lazy(() =>
  import('./pages/ResponsibilityListPage').then((m) => ({ default: m.ResponsibilityListPage }))
);
const RosterCreatePage = lazy(() =>
  import('./pages/RosterCreatePage').then((m) => ({ default: m.RosterCreatePage }))
);
const RosterListPage = lazy(() => import('./pages/RosterListPage').then((m) => ({ default: m.RosterListPage })));
const RosterDetailPage = lazy(() =>
  import('./pages/RosterDetailPage').then((m) => ({ default: m.RosterDetailPage }))
);
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));

function PageLoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Spinner className="h-8 w-8 text-slate-400" />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoadingFallback />}>
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
        </Suspense>
      </AuthProvider>
    </LanguageProvider>
  );
}
