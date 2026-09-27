import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SideTemplate from '../components/SideTemplate';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';

const OnboardingPage = () => {
  const nav = useNavigate();
  const [year, setYear] = useState('');
  const { setUser } = useAuth();
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

  return (
    <div className="grid md:grid-cols-2 h-screen">
      <SideTemplate />
      <div className="flex flex-col items-center justify-center h-screen text-black text-center">
        <h1 className="text-2xl font-bold mb-4">Onboarding</h1>
        <p className="mb-4">Select your current year.</p>
        {errorMessage && <p className="text-red-500 text-sm mb-2">{errorMessage}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="border p-2 rounded mb-4"
          >
            <option value="">Select Year</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
            <option value="3">3rd Year</option>
            <option value="4">Final Year</option>
          </select>
          <button type="submit" className="bg-gray-800 hover:bg-gray-900 cursor-pointer text-white p-2 rounded">
            Continue to Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

export default OnboardingPage;
