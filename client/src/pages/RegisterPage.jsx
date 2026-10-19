import React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import SideTemplate from '../components/SideTemplate';
import { useNavigate } from 'react-router-dom';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import { useTheme } from '../context/ThemeContext';

const RegisterPage = () => {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [errorMessage, setErrorMessage] = useState('');

  const HandleSubmit = async (ele) => {
    ele.preventDefault();
    await api.post('/auth/register', {
      email: email,
      password: password,
      username: username,
    }).then((response) => {
      console.log(response.data);
      setUser(response.data.user);
      nav('/verify-otp');
    }).catch((error) => {
      console.log('Error occur while register ', error);
      setErrorMessage(error.response?.data?.message || 'Unable to register. Please try again.');
    });
  };

  return (
    <div className={`grid h-screen md:grid-cols-2 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      <SideTemplate />
      <div className={`flex h-screen flex-col px-4 py-20 md:px-18 md:py-10 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
        <div className='mb-2 flex items-center justify-between md:mb-6'>
          <Link to="/" className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-200 ${isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-gray-700 hover:bg-gray-100'}`}>
            <ArrowLeft />Back to Home
          </Link>
        </div>
        <h1 className={`py-2 text-2xl font-semibold italic md:text-3xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Create your account
        </h1>
        <div className="Google-Oauth">
          <GoogleAuthButton />
        </div>
        <div className="my-6 flex w-full items-center">
          <div className={`grow border-t ${isDark ? 'border-slate-600' : 'border-gray-300'}`}></div>
          <span className={`mx-4 text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>or use email</span>
          <div className={`grow border-t ${isDark ? 'border-slate-600' : 'border-gray-300'}`}></div>
        </div>
        {errorMessage && (
          <p className={`mb-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {errorMessage}
          </p>
        )}
        <form className='flex flex-col' onSubmit={(e) => HandleSubmit(e)}>
          <label htmlFor='name' className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Name</label>
          <input type='text' min={3} max={20} placeholder='Enter your name' className={`my-2 rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`} value={username} onChange={(e) => setUsername(e.target.value)}></input>
          <label htmlFor="email" className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>Email</label>
          <input type="email" id="email" placeholder='Enter email' className={`my-2 rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`} value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password" className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-500'}`} required>Password</label>
          <input type="password" id="password" placeholder='Enter password' className={`my-2 rounded-md border p-2 ${isDark ? 'border-slate-600 bg-slate-800 text-white placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900'}`} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className='my-4 cursor-pointer rounded-md bg-slate-800 py-2 text-white transition-colors duration-200 hover:bg-slate-700'>Sign up</button>
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>Already have an account? <Link to="/login" className='text-teal-600'>Sign In</Link></p>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
