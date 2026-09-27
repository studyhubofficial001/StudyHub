import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const getUserPath = (user) => {
  if (!user.isVerified) {
    return '/verify-otp';
  }

  if (!user.isProfileComplete) {
    return '/onboarding';
  }

  return '/dashboard';
};

const RouteGuard = ({ access }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (access === 'guest') {
    return user ? <Navigate to={getUserPath(user)} replace /> : <Outlet />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (access === 'verify') {
    return user.isVerified ? <Navigate to={getUserPath(user)} replace /> : <Outlet />;
  }

  if (!user.isVerified) {
    return <Navigate to="/verify-otp" replace />;
  }

  if (access === 'onboarding') {
    return user.isProfileComplete ? <Navigate to="/dashboard" replace /> : <Outlet />;
  }

  if (!user.isProfileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  if (access === 'admin' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default RouteGuard;
