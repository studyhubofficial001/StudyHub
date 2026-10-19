import { Link } from 'react-router-dom';
import Navbar from '../components/HomeNavbar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Home = () => {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}>
      <Navbar />
      <div className="flex flex-col items-center">
        <div className="mt-20 flex flex-col md:mt-30">
          <div className="text-3xl font-bold md:mb-2 md:text-5xl">
            <span className='block w-full text-center italic'>Everything you need to</span>
          </div>
          <div className='text-center'>
            <span className='text-3xl md:text-5xl'>
              <span className='bg-linear-to-t from-yellow-400/60 to-transparent bg-size-[100%_1em] bg-no-repeat px-2 bg-bottom'>actually pass</span> your next exam.
            </span>
          </div>
        </div>
        <div>
          <div className={`py-4 text-center text-sm md:py-6 md:text-lg ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
            <p className='inline'>One shared space for your year&apos;s syllabus — notes, past papers, instant </p>
            <p className='inline text-center md:block'>answers from your own PDFs, and the classmates in your course.</p>
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 gap-4 px-4 py-6 md:grid-cols-2 md:gap-8 md:px-50 md:py-10">
          <div className={`rounded-lg border p-4 px-8 py-6 md:px-10 md:py-8 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-400 bg-white'}`}>
            <h1 className="mb-2 text-md font-bold md:text-xl">Smart Document Q&A</h1>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Stop scrolling through 50-page PDFs. Ask the AI questions directly and get instant answers with exact page citations.</p>
          </div>

          <div className={`rounded-lg border p-4 px-8 py-6 md:px-10 md:py-8 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-400 bg-white'}`}>
            <h1 className="mb-2 text-md font-bold md:text-xl">Exam Prep Engine</h1>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Click one button to instantly extract key concepts and the most important questions from any uploaded study material.</p>
          </div>

          <div className={`rounded-lg border p-4 px-8 py-6 md:px-10 md:py-8 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-400 bg-white'}`}>
            <h1 className="mb-2 text-md font-bold md:text-xl">Zero Clutter Shared Vault</h1>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Upload a file once. Our system automatically prevents duplicates, building a clean, shared resource library for your entire class.</p>
          </div>

          <div className={`rounded-lg border p-4 px-8 py-6 md:px-10 md:py-8 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-400 bg-white'}`}>
            <h1 className="mb-2 text-md font-bold md:text-xl">Subject-Locked Chatrooms</h1>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Automatically join live group chats dedicated exclusively to your current year and course subjects without dealing with spam.</p>
          </div>
        </div>
        <div>
          <div className='py-4 text-center text-xl md:py-8 md:text-4xl'>
            <span className='block py-2 font-bold italic'>Stop studying harder.</span>
            <span>Start studying smarter,<span className='bg-linear-to-t from-yellow-400/60 to-transparent bg-size-[100%_1em] bg-no-repeat px-2 bg-bottom'>Join today.</span></span>
          </div>
          {isAuthenticated && (
            <div className='flex items-center justify-center py-4 md:py-8'>
              <button>
                <Link to="/dashboard" className="rounded-lg border-2 border-slate-800 bg-slate-800 px-4 py-2 text-sm text-white transition-colors duration-200 hover:bg-slate-700 md:px-6 md:py-4 md:text-md">
                  Go to Dashboard
                </Link>
              </button>
            </div>
          )}
          {!isAuthenticated && (
            <div className='flex items-center justify-center py-4 md:py-8'>
              <button>
                <Link to="/register" className="rounded-lg border-2 border-slate-800 bg-slate-800 px-4 py-2 text-sm text-white transition-colors duration-200 hover:bg-slate-700 md:px-6 md:py-4 md:text-md">
                  Create free account
                </Link>
              </button>
              <button>
                <Link to="/login" className={`ml-4 rounded-lg border px-4 py-2 text-sm md:px-6 md:py-4 md:text-md ${isDark ? 'border-slate-600 text-slate-100 hover:bg-slate-800' : 'border-gray-400 text-gray-900 hover:bg-gray-100'}`}>
                  Login
                </Link>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
