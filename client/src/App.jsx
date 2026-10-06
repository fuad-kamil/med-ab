// HMR Cache Refresh
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AdminLayout from './layouts/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import Dashboard from './pages/admin/Dashboard';
import Students from './pages/admin/Students';
import ExamList from './pages/admin/ExamList';
import ExamEditor from './pages/admin/ExamEditor';
import Categories from './pages/admin/Categories';
import Results from './pages/admin/Results';
import Settings from './pages/admin/Settings';
import StudentLogin from './pages/student/StudentLogin';
import TakeExam from './pages/student/TakeExam';
import ExamResult from './pages/student/ExamResult';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
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
