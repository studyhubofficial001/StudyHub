import LoginPage from './pages/LoginPage';
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home';
import RegisterPage from './pages/RegisterPage';
import VerifyOTP from './pages/VerifyOtpPage';
import OnboardingPage from './pages/OnboardingPage';
import AdminSubjects from './pages/AdminSubjects';
import RouteGuard from './components/RouteGuard';

function App() {
  return (
    <Routes>
      <Route element={<RouteGuard access="guest" />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RouteGuard access="verify" />}>
        <Route path="/verify-otp" element={<VerifyOTP />} />
      </Route>

      <Route element={<RouteGuard access="onboarding" />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>

      <Route element={<RouteGuard access="complete" />}>
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Route>

      <Route element={<RouteGuard access="admin" />}>
        <Route path="/admin-panel" element={<AdminSubjects />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;