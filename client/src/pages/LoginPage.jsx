import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import SideTemplate from '../components/SideTemplate';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';

const LoginPage = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (ele) => {
    ele.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await api.post('/auth/login', {
        email: email,
        password: password,
      });
      const loggedInUser = response.data.user;
      if (!loggedInUser) {
        throw new Error('Login succeeded but no user data was returned.');
      }

      setUser(loggedInUser);
      nav(loggedInUser.isProfileComplete ? '/dashboard' : '/onboarding');
    } catch (error) {
      console.error('Error occurred while logging in:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'An error occurred during login.');
    }
  };

  const resetForgotPasswordFlow = () => {
    setShowForgotPassword(false);
    setResetStep('email');
    setResetEmail('');
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSendForgotPasswordOtp = async () => {
    if (!resetEmail.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setResetLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await api.post('/auth/forgot-password/send-otp', {
        email: resetEmail.trim(),
      });
      setSuccessMessage(response.data.message || 'OTP sent to your email.');
      setResetStep('otp');
    } catch (error) {
      console.error('Error sending forgot password OTP:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleVerifyForgotPasswordOtp = async () => {
    if (!resetOtp.trim()) {
      setErrorMessage('Please enter the OTP sent to your email.');
      return;
    }

    setResetLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await api.post('/auth/forgot-password/verify-otp', {
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
      });
      setSuccessMessage(response.data.message || 'OTP verified successfully.');
      setResetStep('password');
    } catch (error) {
      console.error('Error verifying forgot password OTP:', error);
      setErrorMessage(error.response?.data?.message || 'Invalid OTP.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleForgotPasswordReset = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('Please enter a new password and confirm it.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setResetLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await api.post('/auth/forgot-password/reset', {
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        newPassword,
        confirmPassword,
      });
      setSuccessMessage(response.data.message || 'Password reset successful.');
      setPassword('');
      setEmail(resetEmail.trim());
      setResetEmail('');
      setResetOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setResetStep('email');
      setShowForgotPassword(false);
    } catch (error) {
      console.error('Error resetting password:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className={`grid h-screen md:grid-cols-2 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      <SideTemplate />
      <div className={`flex h-screen flex-col px-4 py-20 md:px-18 md:py-12 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
        <div className='mb-6 flex items-center justify-between md:mb-10'>
          <Link to="/" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-200 ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
            <ArrowLeft />Back to Home
          </Link>
        </div>
        <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>WELCOME BACK</h2>
        <h1 className={`py-4 text-2xl font-semibold md:text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Sign in to your dashboard
        </h1>
        <GoogleAuthButton />
        <div className="Google-Oauth"></div>
        <div className="my-6 flex w-full items-center">
          <div className={`grow border-t ${isDark ? 'border-slate-600' : 'border-gray-300'}`}></div>
          <span className={`mx-4 text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>or use email</span>
          <div className={`grow border-t ${isDark ? 'border-slate-600' : 'border-gray-300'}`}></div>
        </div>
        <form className='flex flex-col' onSubmit={handleSubmit}>
          <label htmlFor="email" className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Email</label>
          <input type="email" id="email" placeholder='Enter email' className={`my-2 rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`} value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password" className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Password</label>
          <input type="password" id="password" placeholder='Enter password' className={`my-2 rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className='my-4 cursor-pointer rounded-md bg-slate-800 py-2 text-white transition-colors duration-200 hover:bg-slate-700'>Sign In</button>
          <div className='mb-2 flex items-center justify-between'>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword((current) => !current);
                setErrorMessage('');
                setSuccessMessage('');
                setResetStep('email');
                setResetEmail(email || '');
                setResetOtp('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              className='text-sm font-medium text-teal-600 hover:text-teal-500'
            >
              Forgot password?
            </button>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
              Don&apos;t have an account? <Link to="/register" className='text-teal-600'>Sign up</Link>
            </p>
          </div>

          {showForgotPassword && (
            <div className={`mt-2 rounded-lg border p-4 ${isDark ? 'border-slate-700 bg-slate-800/90' : 'border-gray-200 bg-gray-50'}`}>
              {resetStep === 'email' && (
                <div className='space-y-3'>
                  <label htmlFor="resetEmail" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                    Enter your email
                  </label>
                  <input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder='Enter your account email'
                    className={`w-full rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`}
                  />
                  <button
                    type="button"
                    onClick={handleSendForgotPasswordOtp}
                    disabled={resetLoading}
                    className='w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70'
                  >
                    {resetLoading ? 'Sending OTP...' : 'Send OTP'}
                  </button>
                </div>
              )}

              {resetStep === 'otp' && (
                <div className='space-y-3'>
                  <label htmlFor="resetOtp" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                    Enter the OTP sent to your email
                  </label>
                  <input
                    id="resetOtp"
                    type="text"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder='Enter 6-digit OTP'
                    className={`w-full rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`}
                  />
                  <div className='flex gap-2'>
                    <button
                      type="button"
                      onClick={handleSendForgotPasswordOtp}
                      disabled={resetLoading}
                      className='flex-1 rounded-md border border-teal-600 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-70'
                    >
                      {resetLoading ? 'Sending...' : 'Resend OTP'}
                    </button>
                    <button
                      type="button"
                      onClick={handleVerifyForgotPasswordOtp}
                      disabled={resetLoading}
                      className='flex-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70'
                    >
                      {resetLoading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 'password' && (
                <div className='space-y-3'>
                  <label htmlFor="newPassword" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                    New password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder='Enter new password'
                    className={`w-full rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`}
                  />

                  <label htmlFor="confirmPassword" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder='Confirm new password'
                    className={`w-full rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-900 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`}
                  />

                  <button
                    type="button"
                    onClick={handleForgotPasswordReset}
                    disabled={resetLoading}
                    className='w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-70'
                  >
                    {resetLoading ? 'Resetting...' : 'Set New Password'}
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <p className={`mt-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p className={`mt-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {successMessage}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
