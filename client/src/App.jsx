import LoginPage from './pages/LoginPage';
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home';
import RegisterPage from './pages/RegisterPage';
import VerifyOTP from './pages/VerifyOtpPage';
import OnboardingPage from './pages/OnboardingPage';
import AdminSubjects from './pages/AdminSubjects';
import RouteGuard from './components/RouteGuard';
import Dashboard from './pages/Dashboard';
import UploadResources from './pages/UploadResources';
import UploadSyllabus from './pages/UploadSyllabus';
import Resources from './pages/Resources';
import Settings from './pages/Settings';
import AskAIPage from './pages/AskAIPage';

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
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ask-ai" element={<AskAIPage />} />
      </Route>

      <Route element={<RouteGuard access="admin" />}>
        <Route path="/admin-panel" element={<AdminSubjects />} />
      </Route>

      <Route element={<RouteGuard access="admin" />}>
        <Route path="/upload-resources" element={<UploadResources />} />
        <Route path="/upload-syllabus" element={<UploadSyllabus />} />
      </Route>

      <Route element={<RouteGuard access="complete" />}>
        <Route path="/resources" element={<Resources />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;