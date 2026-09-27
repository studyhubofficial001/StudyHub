import { Link } from 'react-router-dom'
import Navbar from '../components/HomeNavbar'
import { useAuth } from '../context/AuthContext'
const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <Navbar />
      <div className="flex flex-col items-center ">
        <div className="flex flex-col mt-20 md:mt-30">
        <div className="text-3xl md:text-5xl font-bold md:mb-2"><span className='w-full block text-center italic'>Everything you need to</span>
        </div>
        <div className='text-center' ><span className='text-3xl md:text-5xl'>
          <span className='bg-linear-to-t from-yellow-400/60 to-transparent bg-size-[100%_1em] bg-no-repeat px-2 bg-bottom'>actually pass</span> your next exam.</span></div>
      </div>
      <div>
        <div className='text-gray-600 py-4 md:py-6 text-sm md:text-lg text-center'>
          <p className='inline' >One shared space for your year's syllabus — notes, past papers, instant </p>
          <p className='text-center inline md:block'>answers from your own PDFs, and the classmates in your course.</p>
        </div>
      </div>
      </div>

      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 px-4 md:px-50 py-6 md:py-10">

          <div className="border border-gray-400 p-4 rounded-lg px-8 py-6 md:py-8 md:px-10">
            <h1 className="text-md  md:text-xl font-bold mb-2">Smart Document Q&A</h1>
            <p className='text-sm text-gray-600'>Stop scrolling through 50-page PDFs. Ask the AI questions directly and get instant answers with exact page citations.</p>
          </div>

          <div className=" border border-gray-400 p-4 rounded-lg px-8 py-6 md:py-8 md:px-10">
            <h1 className="text-md  md:text-xl font-bold mb-2">Exam Prep Engine</h1>
            <p className='text-sm text-gray-600'>Click one button to instantly extract key concepts and the most important questions from any uploaded study material.</p>
          </div>

          <div className="border border-gray-400 p-4 rounded-lg px-8 py-6 md:py-8 md:px-10">
            <h1 className="text-md  md:text-xl font-bold mb-2">Zero Clutter Shared Vault</h1>
            <p className='text-sm text-gray-600'>Upload a file once. Our system automatically prevents duplicates, building a clean, shared resource library for your entire class.</p>
          </div>

          <div className="border border-gray-400 p-4 rounded-lg px-8 py-6 md:py-8 md:px-10">
            <h1 className="text-md  md:text-xl font-bold mb-2">Subject-Locked Chatrooms</h1>
            <p className='text-sm text-gray-600'>Automatically join live group chats dedicated exclusively to your current year and course subjects without dealing with spam.</p>
          </div>

        </div>
        <div>
          <div className='text-center text-xl md:text-4xl py-4 md:py-8'>
            <span className='block italic font-bold py-2'>Stop studying harder.</span>
            <span>Start studying smarter,<span className='bg-linear-to-t from-yellow-400/60 to-transparent bg-size-[100%_1em] bg-no-repeat px-2 bg-bottom' >Join today.</span></span>
          </div>
          {isAuthenticated && <div className='flex justify-center items-center py-4 md:py-8'>
            <button>
              <Link to="/dashboard" className="text-white text-sm bg-gray-800 md:text-md border-2 hover:bg-gray-900 md:px-6 md:py-4 px-4 py-2 rounded-lg">
                Go to Dashboard
              </Link>
            </button>
          </div>}
          {!isAuthenticated && (
            <div className='flex justify-center items-center py-4 md:py-8'>
              <button>
                <Link to="/register" className="text-white text-sm bg-gray-800 md:text-md border-2 hover:bg-gray-900 md:px-6 md:py-4 px-4 py-2 rounded-lg">
                  Create free account
                </Link>
              </button>
              <button>
                <Link to="/login" className="text-gray-900 text-sm md:text-md border border-gray-400 hover:bg-gray-100 md:px-6 px-4 py-2 md:py-4 rounded-lg ml-4">
                  Login
                </Link>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home
