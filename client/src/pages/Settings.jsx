import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/axiosInstance';
import SidebarNav from '../components/SidebarNav';
import MobileNav from '../components/MobileNav';
import TabBar from '../components/TabBar';

const Settings = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [isResendingEmailOtp, setIsResendingEmailOtp] = useState(false);
  const [showPasswordOtpModal, setShowPasswordOtpModal] = useState(false);
  const [passwordOtp, setPasswordOtp] = useState('');
  const [passwordResetMode, setPasswordResetMode] = useState('current');
  const [isSendingPasswordOtp, setIsSendingPasswordOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const isDark = theme === 'dark';
  const shellTheme = isDark ? 'bg-slate-900 text-slate-100' : 'bg-[rgb(244,247,239)] text-slate-900';
  const navPanelTheme = isDark ? 'border-slate-700 bg-slate-800/80 text-slate-100' : 'border-slate-200 bg-white text-slate-900';
  const inputTheme = isDark
    ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus:border-teal-400'
    : 'border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-500 focus:border-gray-500';
  const mutedText = isDark ? 'text-slate-300' : 'text-slate-600';
  const primaryButton = isDark
    ? 'bg-slate-700 text-white hover:bg-slate-600'
    : 'bg-slate-900 text-white hover:bg-slate-800';
  const secondaryButton = isDark
    ? 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
    : 'border-slate-300 bg-transparent text-slate-700 hover:bg-slate-100';
  const dangerButton = isDark
    ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200'
    : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  };

  const sendEmailOtpRequest = async (emailValue) => {
    const response = await api.post('/auth/change-email', { email: emailValue });
    setPendingEmail(response.data.pendingEmail || emailValue);
    setShowEmailOtpModal(true);
    return response;
  };

  const handleChangeEmail = async (event) => {
    event.preventDefault();
    setStatusType('');
    setStatusMessage('');

    if (!newEmail.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter a new email address.');
      return;
    }

    try {
      setIsChangingEmail(true);
      const response = await sendEmailOtpRequest(newEmail.trim());
      setStatusType('success');
      setStatusMessage(response.data.message || 'OTP sent to your current email.');
      setEmailOtp('');
      setNewEmail('');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.response?.data?.message || 'Failed to change email.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleVerifyEmailOtp = async (event) => {
    event.preventDefault();
    if (!emailOtp.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter the OTP sent to your current email.');
      return;
    }

    try {
      setIsVerifyingEmailOtp(true);
      const response = await api.post('/auth/verify-email-change', { otp: emailOtp.trim() });
      setShowEmailOtpModal(false);
      setEmailOtp('');
      setPendingEmail('');
      setStatusType('success');
      setStatusMessage(response.data.message || 'Email updated successfully.');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.response?.data?.message || 'Could not verify email change OTP.');
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (!pendingEmail) {
      setStatusType('error');
      setStatusMessage('No pending email update found.');
      return;
    }

    try {
      setIsResendingEmailOtp(true);
      const response = await api.post('/auth/change-email', { email: pendingEmail });
      setStatusType('success');
      setStatusMessage(response.data.message || 'A new OTP has been sent to your current email.');
      setEmailOtp('');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setIsResendingEmailOtp(false);
    }
  };

  const handleCurrentPasswordUpdate = async (event) => {
    event.preventDefault();
    setStatusType('');
    setStatusMessage('');

    if (!currentPassword && user?.password) {
      setStatusType('error');
      setStatusMessage('Current password is required.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setStatusType('error');
      setStatusMessage('New password and confirmation are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusType('error');
      setStatusMessage('New password and confirmation must match.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const response = await api.post('/auth/update-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setStatusType('success');
      setStatusMessage(response.data.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.response?.data?.message || 'Could not update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleForgotPasswordOtp = async () => {
    try {
      setIsSendingPasswordOtp(true);
      const response = await api.post('/auth/send-password-reset-otp');
      setShowPasswordOtpModal(true);
      setPasswordOtp('');
      setStatusType('success');
      setStatusMessage(response.data.message || 'OTP sent to your email.');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.response?.data?.message || 'Could not send password reset OTP.');
    } finally {
      setIsSendingPasswordOtp(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!passwordOtp.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter the OTP sent to your email.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setStatusType('error');
      setStatusMessage('New password and confirmation are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusType('error');
      setStatusMessage('New password and confirmation must match.');
      return;
    }

    try {
      setIsResettingPassword(true);
      const response = await api.post('/auth/reset-password', {
        otp: passwordOtp.trim(),
        newPassword,
        confirmPassword,
      });
      setShowPasswordOtpModal(false);
      setPasswordOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordResetMode('current');
      setStatusType('success');
      setStatusMessage(response.data.message || 'Password changed successfully.');
    } catch (error) {
      setStatusType('error');
      setStatusMessage(error.response?.data?.message || 'Could not reset your password.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className={`flex min-h-screen flex-col md:grid md:h-screen md:min-h-0 md:grid-cols-[16rem_minmax(0,1fr)] md:p-10 md:mb-0 mb-10 ${shellTheme}`}>
      <div className="hidden md:block md:mr-2 md:mb-0 mb-4 md:sticky md:top-10 md:self-start">
        <SidebarNav />
      </div>
      <MobileNav userName={user?.name} />
      <div className="md:hidden">
        <TabBar />
      </div>

      <div className="w-full min-w-0 overflow-y-auto p-4 md:h-[calc(100vh-5rem)] md:p-0 md:pr-2">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className={`text-3xl md:text-4xl font-bold italic ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h1>
              <p className={`mt-1 text-sm ${mutedText}`}>Manage your account and preferences.</p>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                statusType === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {statusMessage}
            </div>
          )}

          <div className="grid gap-6">
            <div className={`rounded-2xl border p-5 shadow-sm ${navPanelTheme}`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Appearance</h2>
              </div>
              <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Theme</p>
                  <p className={`text-xs ${mutedText}`}>Switch between light and dark mode.</p>
                </div>
                <button
                  type="button"
                  aria-label="Toggle color theme"
                  aria-pressed={isDark}
                  onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                    isDark ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      isDark ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className={`rounded-2xl border p-5 shadow-sm ${navPanelTheme}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">College email</h2>
              </div>
              <p className={`mb-4 text-sm ${mutedText}`}>
                {user?.email || 'riya.sharma@college.edu'} — changing this requires OTP verification.
              </p>

              <form onSubmit={handleChangeEmail} className="space-y-3">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="Enter new email"
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:outline-none ${inputTheme}`}
                />
                <button
                  type="submit"
                  disabled={isChangingEmail}
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryButton}`}
                >
                  {isChangingEmail ? 'Sending OTP...' : 'Change email'}
                </button>
              </form>
            </div>

            <div className={`rounded-2xl border p-5 shadow-sm ${navPanelTheme}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Password</h2>
              </div>
              <p className={`mb-4 text-sm ${mutedText}`}>
                Last changed {user?.passwordUpdatedAt ? new Date(user.passwordUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'recently'}.
              </p>

              {passwordResetMode === 'current' ? (
                <form onSubmit={handleCurrentPasswordUpdate} className="space-y-3">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Current password"
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:outline-none ${inputTheme}`}
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="New password"
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:outline-none ${inputTheme}`}
                  />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirm new password"
                    className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:outline-none ${inputTheme}`}
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryButton}`}
                  >
                    {isUpdatingPassword ? 'Updating...' : 'Update password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordResetMode('forgot');
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition ${secondaryButton}`}
                  >
                    Forgot current password?
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className={`text-sm ${mutedText}`}>We will send an OTP to your current email so you can reset the password safely.</p>
                  <button
                    type="button"
                    onClick={handleForgotPasswordOtp}
                    disabled={isSendingPasswordOtp}
                    className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryButton}`}
                  >
                    {isSendingPasswordOtp ? 'Sending OTP...' : 'Send OTP to email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasswordResetMode('current')}
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition ${secondaryButton}`}
                  >
                    Use current password instead
                  </button>
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-5 shadow-sm ${navPanelTheme}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Sign out</h2>
              </div>
              <p className={`mb-4 text-sm ${mutedText}`}>End your session on this device.</p>
              <button
                type="button"
                onClick={handleLogout}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition ${dangerButton}`}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEmailOtpModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setShowEmailOtpModal(false)}
          />
          <div className={`fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Verify current email</h3>
              <button type="button" onClick={() => setShowEmailOtpModal(false)} className={`text-2xl ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>×</button>
            </div>
            <p className={`mb-4 text-sm ${mutedText}`}>
              We sent a 6-digit OTP to <span className="font-medium">{user?.email}</span> to confirm the change to <span className="font-medium">{pendingEmail}</span>.
            </p>
            <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${mutedText}`}>OTP</label>
                <input
                  type="text"
                  value={emailOtp}
                  onChange={(event) => setEmailOtp(event.target.value)}
                  placeholder="Enter 6-digit OTP"
                  className={`rounded-xl border px-3 py-2.5 text-sm outline-none transition ${inputTheme}`}
                  maxLength={6}
                  required
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={handleResendEmailOtp} disabled={isResendingEmailOtp} className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-60">
                  {isResendingEmailOtp ? 'Resending...' : 'Resend OTP'}
                </button>
                <button type="submit" disabled={isVerifyingEmailOtp} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryButton}`}>
                  {isVerifyingEmailOtp ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {showPasswordOtpModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setShowPasswordOtpModal(false)}
          />
          <div className={`fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-md rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Reset password</h3>
              <button type="button" onClick={() => setShowPasswordOtpModal(false)} className={`text-2xl ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}>×</button>
            </div>
            <p className={`mb-4 text-sm ${mutedText}`}>We sent an OTP to <span className="font-medium">{user?.email}</span>.</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${mutedText}`}>OTP</label>
                <input
                  type="text"
                  value={passwordOtp}
                  onChange={(event) => setPasswordOtp(event.target.value)}
                  placeholder="Enter 6-digit OTP"
                  className={`rounded-xl border px-3 py-2.5 text-sm outline-none transition ${inputTheme}`}
                  maxLength={6}
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${mutedText}`}>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                  className={`rounded-xl border px-3 py-2.5 text-sm outline-none transition ${inputTheme}`}
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className={`mb-1 text-sm font-medium ${mutedText}`}>Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  className={`rounded-xl border px-3 py-2.5 text-sm outline-none transition ${inputTheme}`}
                  required
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={handleForgotPasswordOtp} disabled={isSendingPasswordOtp} className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-60">
                  {isSendingPasswordOtp ? 'Sending...' : 'Resend OTP'}
                </button>
                <button type="submit" disabled={isResettingPassword} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${primaryButton}`}>
                  {isResettingPassword ? 'Resetting...' : 'Reset password'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
