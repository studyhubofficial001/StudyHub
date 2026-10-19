import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className={`sticky top-0 z-50 flex h-auto items-center justify-between border-b px-4 py-3 text-xl backdrop-blur-md md:px-10 md:py-4 md:text-3xl ${isDark ? 'border-slate-700 bg-slate-900/80 text-slate-100' : 'border-gray-300 bg-white/70 text-slate-900'}`}>
      <div className='cursor-pointer'>
        <span>Study</span>
        <span className='font-bold text-teal-700'>Hub</span>
      </div>

      <div className="flex space-x-2 md:space-x-8 md:px-6">
        <Link to="/login" className={`rounded-xl px-4 py-1 text-sm transition-colors duration-200 md:text-xl ${isDark ? 'text-slate-200 hover:bg-slate-800 hover:text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
          Sign In
        </Link>
        <Link to="/register" className={`rounded-full border px-7 py-1 text-sm transition-colors duration-200 md:text-xl ${isDark ? 'border-slate-600 text-slate-100 hover:bg-slate-800 hover:text-white' : 'border-gray-400 text-gray-700 hover:bg-gray-100'}`}>
          Sign Up
        </Link>
      </div>
    </div>
  );
};

export default Navbar;
