import React from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import SideTemplate from '../components/SideTemplate'
import { useNavigate } from 'react-router-dom'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axiosInstance'

const RegisterPage = () => {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const { setUser } = useAuth()
  const [errorMessage, setErrorMessage] = useState('')

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
      console.log("Error occur while register ", error)
      setErrorMessage(error.response?.data?.message || 'Unable to register. Please try again.');
    })
  }

  return (
    <div className="grid md:grid-cols-2 h-screen">
      <SideTemplate />
      <div className=" flex-col md:py-10 py-20 px-4 md:px-18 h-screen text-black">
        <div className='flex flex-row justify-between mb-2 md:mb-6 items-center'>
          <Link to="/" className='text-gray-700 text-sm hover:bg-gray-100 py-2 px-3 flex items-center gap-2 rounded-xl'>
            <ArrowLeft />Back to Home
          </Link>
          </div>
        <h1 className='text-2xl md:text-3xl text-gray-900 font-semibold py-2 italic'>
          Create your account
        </h1>
        <div className="Google-Oauth">
          <GoogleAuthButton />
        </div>
        <div className="flex items-center my-6 w-full">
          <div className="grow border-t border-gray-300"></div>
          <span className="mx-4 text-sm text-gray-500">or use email</span>
          <div className="grow border-t border-gray-300"></div>
        </div>
        {errorMessage && <p className="text-red-500 text-sm mb-2">{errorMessage}</p>}
        <form className='flex flex-col' onSubmit={(e) => HandleSubmit(e)}>
          <label htmlFor='name' className='text-sm text-gray-500' >Name</label>
          <input type='text' min={3} max={20} placeholder='Enter your name' className='border p-2 outline-gray-500 border-gray-300 rounded-md my-2' value={username} onChange={(e)=> setUsername(e.target.value)}></input>
          <label htmlFor="email" className='text-sm text-gray-500'>Email</label>
          <input type="email" id="email" placeholder='Enter email' className='border outline-gray-500 p-2 border-gray-300 rounded-md my-2' value={email} onChange={(e) => setEmail(e.target.value)} />
          <label htmlFor="password" className='text-sm text-gray-500' required >Password</label>
          <input type="password" id="password" placeholder='Enter password' className='border p-2 border-gray-300 outline-gray-500 rounded-md my-2' value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className='bg-gray-800 cursor-pointer text-white py-2 rounded-md my-4 hover:bg-gray-900'>Sign up</button>
          <p className='text-sm'>Already have an account? <Link to="/login" className='text-teal-700'>Sign In</Link></p>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
