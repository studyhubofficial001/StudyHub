import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import SideTemplate from '../components/SideTemplate';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';

const VerifyOtpPage = () => {
  const nav = useNavigate();
  const [otp, setOtp] = useState('');
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const email = user?.email || '';
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/verify-otp', { otp });
      const verifiedUser = response.data.user;
      if (!verifiedUser) {
        throw new Error('OTP verification succeeded but no user was returned.');
      }

      setUser(verifiedUser);
      nav(verifiedUser.isProfileComplete ? '/dashboard' : '/onboarding');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'An error occurred while verifying OTP.');
    }
  };

  const resendOTP = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/resend-otp');
      alert('OTP resent successfully!');
      setErrorMessage('');
    } catch (error) {
      console.error('Error resending OTP:', error);
      setErrorMessage(error.response?.data?.message || 'An error occurred while resending OTP.');
    }
  };

  return (
    <div className={`grid h-screen md:grid-cols-2 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      <SideTemplate />
      <div className={`flex h-screen flex-col items-center justify-center text-center ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
        <h1 className="mb-4 text-2xl font-bold">Verify OTP</h1>
        <p className={`mb-2 block ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
          An OTP has been sent to your email.
          <span className="block font-semibold">Email : {email}</span>
        </p>
        {errorMessage && (
          <p className={`mb-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {errorMessage}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <input
            type="text"
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
            className={`mb-4 rounded border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`}
          />
          <button type="submit" className="cursor-pointer rounded bg-slate-800 p-2 text-white transition-colors duration-200 hover:bg-slate-700">
            Verify
          </button>
        </form>
        <form onSubmit={resendOTP}>
          <button type="submit" className={`mt-4 inline-block cursor-pointer rounded text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}>
            Resend OTP
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
