// frontend/src/auth/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-4">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
