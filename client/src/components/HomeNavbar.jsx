import { Link } from 'react-router-dom'

const Navbar = () => {
  return (
      <div className="sticky top-0 flex justify-between items-center px-4 py-3 md:px-10 md:py-4 text-xl md:text-3xl h-auto border-b bg-white/70 backdrop-blur-md z-50 border-gray-300">
        <div className='cursor-pointer'><span>Study</span><span className='text-teal-700 font-bold'>Hub</span>
        </div>

        <div className="flex space-x-2 md:space-x-8 md:px-6">
          <Link to="/login" className="text-gray-700 text-sm md:text-xl hover:bg-gray-100 px-4 py-1 rounded-xl">
            Sign In
          </Link>
          <Link to="/register" className="text-gray-700 text-sm md:text-xl border border-gray-400 hover:bg-gray-100 px-7 py-1 rounded-full">
            Sign Up
          </Link>
        </div>
      </div>
  )
}

export default Navbar
