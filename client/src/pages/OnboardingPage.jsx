import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SideTemplate from '../components/SideTemplate';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';

const OnboardingPage = () => {
  const nav = useNavigate();
  const [year, setYear] = useState('');
  const { setUser, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    try {
      const response = await api.patch('/users/onboarding', { year });
      const onboardedUser = response.data.user;
      if (!onboardedUser) {
        throw new Error('Onboarding succeeded but no user data was returned.');
      }

      setUser(onboardedUser);
      nav('/dashboard');
    } catch (error) {
      console.error('Error occurred while submitting onboarding data:', error);
      setErrorMessage(error.response?.data?.message || error.message || 'An error occurred during onboarding.');
    }
  };

  const handleUseDifferentEmail = async () => {
    await logout();
    nav('/login', { replace: true });
  };

  return (
    <div className={`grid h-screen md:grid-cols-2 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      <SideTemplate />
      <div className={`flex h-screen flex-col items-center justify-center text-center ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
        <h1 className="mb-4 text-2xl font-bold">Onboarding</h1>
        <p className={`mb-4 ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Select your current year.</p>
        {errorMessage && (
          <p className={`mb-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {errorMessage}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`mb-4 rounded border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
          >
            <option value="">Select Year</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">Final Year</option>
          </select>
          <button type="submit" className="cursor-pointer rounded bg-slate-800 p-2 text-white transition-colors duration-200 hover:bg-slate-700">
            Continue to Dashboard
          </button>
        </form>
        <button
          type="button"
          onClick={handleUseDifferentEmail}
          className={`mt-4 text-sm underline ${isDark ? 'text-teal-300 hover:text-teal-200' : 'text-teal-700 hover:text-teal-600'}`}
        >
          Use a different email
        </button>
      </div>
    </div>
  );
};

export default OnboardingPage;
