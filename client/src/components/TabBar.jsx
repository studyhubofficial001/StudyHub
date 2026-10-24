import { House, NotepadText, Settings, Bot, UserRoundGroup, UserStar, FileCode2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const TabBar = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const tabClass = isDark
    ? "text-slate-200 hover:bg-slate-800"
    : "text-slate-700 hover:bg-gray-100";

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 border-t md:hidden ${isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
      <div className="flex justify-around">
        <Link to="/dashboard" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
          <House size={22} />
          <span>Home</span>
        </Link>
        <Link to="/resources" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
          <NotepadText size={22} />
          <span>Resources</span>
        </Link>
        <Link to="/pyq-code" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
          <FileCode2 size={22} />
          <span>PYQs &amp; Code</span>
        </Link>
        {/* <Link to="/chat" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
          <UserRoundGroup size={22} />
          <span>Chat</span>
        </Link> */}
        <Link to="/ask-ai" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
          <Bot size={22} />
          <span>Ask AI</span>
        </Link>

        {user?.role === "admin" ? (
          <Link to="/admin-panel" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
            <UserStar size={22} />
            <span>Admin</span>
          </Link>
        ) : (
          <Link to="/settings" className={`flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-[10px] transition-colors ${tabClass}`}>
            <Settings size={22} />
            <span>Settings</span>
          </Link>
        )}
      </div>
    </div>
  );
};

export default TabBar;