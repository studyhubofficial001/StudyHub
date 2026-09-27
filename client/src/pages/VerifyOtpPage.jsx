import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import SideTemplate from '../components/SideTemplate';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';

const VerifyOtpPage = () => {
  const nav = useNavigate();
  const [otp, setOtp] = useState('');
  const { user, setUser } = useAuth();
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
    <div className="grid md:grid-cols-2 h-screen">
      <SideTemplate />
      <div className="flex flex-col items-center justify-center h-screen text-black text-center">
        <h1 className="text-2xl font-bold mb-4">Verify OTP</h1>
        <p className="mb-2 block">
          An OTP has been sent to your email.
          <span className="font-semibold block">Email : {email}</span>
        </p>
        {errorMessage && <p className="text-red-500 text-sm mb-2">{errorMessage}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col items-center">
          <input
            type="text"
            id="otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
            className="border p-2 rounded mb-4"
          />
          <button type="submit" className="bg-gray-800 hover:bg-gray-900 cursor-pointer text-white p-2 rounded">
            Verify
          </button>
        </form>
        <form onSubmit={resendOTP}>
          <button type="submit" className="cursor-pointer text-blue-600 mt-4 text-sm inline-block rounded">
            Resend OTP
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
