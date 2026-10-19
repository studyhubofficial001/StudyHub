import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const SidebarNav = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const firstName = user?.name?.split(" ")[0] || "";
  const surname = user?.name?.split(" ")[1] || "";
  const twoLetterName = `${firstName.charAt(0)?.toUpperCase() || ""}${surname.charAt(0)?.toUpperCase() || ""}`;
  const year = user?.year || "";
  const formattedYear = year ? year === 1 ? "1st Year" : year == 2 ? "2nd Year" : year == 3 ? "3rd Year" : year == 4 ? "4th Year" : "" : "";
  const username = user?.name ? user.name[0].toUpperCase() + user.name.slice(1) : "User";
  const navLinkClass = isDark
    ? "text-slate-100 hover:bg-slate-700/80"
    : "text-slate-800 hover:bg-[rgb(229,233,222)]";
  const sectionTitleClass = isDark ? "text-slate-400" : "text-gray-500";
  const dividerClass = isDark ? "border-slate-700" : "border-gray-300";

  return (
    <div className="h-full overflow-hidden md:h-[calc(100vh-5rem)]">
      <nav className="flex h-full flex-col overflow-hidden">
        <div className="hidden cursor-pointer text-3xl md:block md:pb-10">
          <span>Study</span>
          <span className="font-bold text-teal-700">Hub</span>
        </div>

        <ul className="group flex flex-1 flex-col space-y-4 md:space-y-0">
          <h1 className={`md:text-[12px] text-[10px] md:mb-3 ${sectionTitleClass}`}>WORKSPACE</h1>
          <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:p-3 ${navLinkClass}`}>
            <Link to="/dashboard">Dashboard</Link>
          </li>
          <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:p-3 ${navLinkClass}`}>
            <Link to="/resources">Resources</Link>
          </li>
          <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:p-3 ${navLinkClass}`}>
            <Link to="/ask-ai">Ask AI</Link>
          </li>
          {/* <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:p-3 ${navLinkClass}`}>
            <Link to="/code-editor">Code Editor</Link>
          </li>
          <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:p-3 ${navLinkClass}`}>
            <Link to="/chat">Group chat</Link>
          </li> */}
          {user?.role === "admin" && (
            <>
              <h1 className={`md:text-[12px] text-[10px] md:my-2 ${sectionTitleClass}`}>MANAGE</h1>
              <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:p-3 ${navLinkClass}`}>
                <Link to="/admin-panel">Admin panel</Link>
              </li>
            </>
          )}
          <li className={`cursor-pointer rounded-xl p-2 text-xl transition-colors md:mb-3 md:p-3 ${navLinkClass}`}>
            <Link to="/settings">Settings</Link>
          </li>
        </ul>

        <div className={`mt-1 border-t pt-4 ${dividerClass}`}>
          <div className="hidden w-full flex-row items-center md:flex">
            <div className="flex w-full items-center justify-start">
              <div className="flex h-13 w-13 items-center justify-center rounded-full bg-red-400 font-semibold text-white">
                {twoLetterName}
              </div>
              <div className="flex flex-col leading-tight">
                <p className={`px-2 ${isDark ? "text-slate-100" : "text-slate-900"}`}>{username}</p>
                <p className={`px-2 text-[10px] md:text-[12px] ${sectionTitleClass}`}>{formattedYear} - BCA</p>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default SidebarNav;