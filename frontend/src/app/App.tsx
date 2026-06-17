import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { Toaster } from '../shared/ui/sonner';
import { AuthProvider, useAuth } from './providers/AuthProvider';

import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { HomePage } from '../pages/HomePage';
import { WorkstationPage } from '../pages/WorkstationPage';
import { LogSubmitPage } from '../pages/LogSubmitPage';
import { RecordsPage } from '../pages/RecordsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AdminPage } from '../pages/AdminPage';
import { NotesPage } from '../pages/NotesPage';
import { ContentPage } from '../pages/ContentPage';
import { ContentDetailPage } from '../pages/ContentDetailPage';
import { ProfilePage } from '../pages/ProfilePage';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isLoggedIn, isAdmin, isAuthReady } = useAuth();
  const location = useLocation();
  if (!isAuthReady) return <div className="min-h-screen bg-[#f8f8f7]" />;
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/scripts"
          element={<ProtectedRoute><ContentPage kind="scripts" /></ProtectedRoute>}
        />
        <Route
          path="/scripts/:contentId"
          element={<ProtectedRoute><ContentDetailPage kind="scripts" /></ProtectedRoute>}
        />
        <Route
          path="/works"
          element={<ProtectedRoute><ContentPage kind="works" /></ProtectedRoute>}
        />
        <Route
          path="/works/:contentId"
          element={<ProtectedRoute><ContentDetailPage kind="works" /></ProtectedRoute>}
        />
        <Route
          path="/blogs"
          element={<ProtectedRoute><ContentPage kind="blogs" /></ProtectedRoute>}
        />
        <Route
          path="/blogs/:contentId"
          element={<ProtectedRoute><ContentDetailPage kind="blogs" /></ProtectedRoute>}
        />
        <Route
          path="/workstation"
          element={<ProtectedRoute><WorkstationPage /></ProtectedRoute>}
        />
        <Route
          path="/workstation/services/:serviceId"
          element={<ProtectedRoute><LogSubmitPage /></ProtectedRoute>}
        />
        <Route
          path="/workstation/services/log-auto-submit"
          element={<Navigate to="/workstation/services/service_log_auto_submit" replace />}
        />
        <Route
          path="/workstation/log-submit"
          element={<Navigate to="/workstation/services/service_log_auto_submit" replace />}
        />
        <Route
          path="/workstation/records"
          element={<ProtectedRoute><RecordsPage /></ProtectedRoute>}
        />
        <Route
          path="/workstation/records/:requestId"
          element={<ProtectedRoute><RecordsPage /></ProtectedRoute>}
        />
        <Route path="/records" element={<Navigate to="/workstation/records" replace />} />
        <Route
          path="/me"
          element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/invite-codes"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/users"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/scripts"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/works"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/blogs"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/messages"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/workstation/services"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/service-requests"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/audit-logs"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/dashboard/snapshots"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/exports/:exportName"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route
          path="/admin/:section"
          element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-right" />
    </HashRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
