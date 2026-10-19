import { Link } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const MobileNav = ({ userName }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const nameParts = (userName ?? "").trim().split(/\s+/);
  const userInitials = `${nameParts[0]?.charAt(0) ?? ""}${nameParts[1]?.charAt(0) ?? ""}`.toUpperCase();

  return (
    <div className={`sticky top-0 z-30 mb-4 flex w-full items-center gap-4 border-b px-4 py-3 backdrop-blur-md md:hidden md:mx-0 ${isDark ? "border-slate-700 bg-slate-900/80" : "border-white/60 bg-white/75"}`}>
      <Link to="/" className={`transition-colors duration-300 ${isDark ? "text-slate-100 hover:text-white" : "text-gray-700 hover:text-gray-900"}`}>
        <div className="text-2xl">
          <span>Study</span>
          <span className="font-bold text-teal-700">Hub</span>
        </div>
      </Link>
      <Link to="/settings" className={`ml-auto transition-colors duration-300 ${isDark ? "text-slate-200 hover:text-white" : "text-gray-700 hover:text-gray-900"}`}>
        <div
          role="img"
          aria-label={`${userName || "User"} profile`}
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-400 font-medium text-gray-900"
        >
          {userInitials}
        </div>
      </Link>
    </div>
  );
};

export default MobileNav;
