import { useNavigate,Link } from 'react-router-dom'
import { useState } from 'react'
import SideTemplate from '../components/SideTemplate'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft } from 'lucide-react'
import api from '../api/axiosInstance'

const LoginPage = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const handleSubmit = async (ele) => {
    ele.preventDefault();
    setErrorMessage('');
    try {
      const response = await api.post('/auth/login', {
        email: email,
        password: password
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
  }
  return (
    <>
      <div className="grid md:grid-cols-2 h-screen">
        <SideTemplate />
        <div className=" flex-col md:py-12 py-20 px-4 md:px-18 h-screen text-black">
          <div className='flex flex-row justify-between mb-6 md:mb-10 items-center'>
          <Link to="/" className='text-gray-700 text-sm hover:bg-gray-100 py-2 px-3 flex items-center gap-2 rounded-xl'>
            <ArrowLeft />Back to Home
          </Link>
          </div>
          <h2 className='text-sm font-semibold text-gray-500'>WELCOME BACK</h2>
          <h1 className='text-2xl md:text-3xl text-gray-900 font-semibold py-4'>
            Sign in to your dashboard
          </h1>
          <GoogleAuthButton/>
          <div className="Google-Oauth"></div>
          <div className="flex items-center my-6 w-full">
            <div className="grow border-t border-gray-300"></div>
            <span className="mx-4 text-sm text-gray-500">or use email</span>
            <div className="grow border-t border-gray-300"></div>
          </div>
          <form className='flex flex-col' onSubmit={handleSubmit}>
            <label htmlFor="email" className='text-sm text-gray-500'>Email</label>
            <input type="email" id="email" placeholder='Enter email' className='border p-2 border-gray-300 rounded-md my-2' value={email} onChange={(e) => setEmail(e.target.value)} />
            <label htmlFor="password" className='text-sm text-gray-500'>Password</label>
            <input type="password" id="password" placeholder='Enter password' className='border p-2 border-gray-300 rounded-md my-2' value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" className='bg-gray-800 cursor-pointer text-white py-2 rounded-md my-4 hover:bg-gray-900'>Sign In</button>
            <p className='text-sm'>Don't have an account? <Link to="/register" className='text-teal-700'>Sign up</Link></p>
            {errorMessage && <p className='text-red-500 text-sm'>{errorMessage}</p>}
          </form>
        </div>
        </div>
    </>
  )
}

export default LoginPage
