import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AdminLayout from './layouts/AdminLayout';
import { LoadingScreen } from './components/Spinner';

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Students = lazy(() => import('./pages/admin/Students'));
const ExamList = lazy(() => import('./pages/admin/ExamList'));
const ExamEditor = lazy(() => import('./pages/admin/ExamEditor'));
const Categories = lazy(() => import('./pages/admin/Categories'));
const Results = lazy(() => import('./pages/admin/Results'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const StudentLogin = lazy(() => import('./pages/student/StudentLogin'));
const TakeExam = lazy(() => import('./pages/student/TakeExam'));
const ExamResult = lazy(() => import('./pages/student/ExamResult'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Admin auth */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Admin protected routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="exams" element={<ExamList />} />
          <Route path="exams/:id" element={<ExamEditor />} />
          <Route path="categories" element={<Categories />} />
          <Route path="results" element={<Results />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Student exam routes */}
        <Route path="/exam" element={<StudentLogin />} />
        <Route path="/exam/take" element={<TakeExam />} />
        <Route path="/exam/result" element={<ExamResult />} />
        <Route path="/exam/:token" element={<StudentLogin />} />
        <Route path="/exam/:token/active" element={<TakeExam />} />
        <Route path="/exam/:token/result" element={<ExamResult />} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/admin" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}


export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
