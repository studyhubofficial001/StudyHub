import { useState } from "react";
import { Link } from "react-router-dom";
import {useNavigate} from "react-router-dom";

const SidebarNav = () => {

  return (
    <div >
      <nav>
        <div className='text-3xl md:pb-10 hidden md:block cursor-pointer'><span>Study</span><span className='text-teal-700 font-bold'>Hub</span>
        </div>
        <ul className="flex flex-col space-y-4 md:space-y-0  group">
          <h1 className="text-gray-500 md:text-[12px] text-[10px] md:mb-3" >WORKSPACE</h1>
          <li className="cursor-pointer md:p-3 p-2 hover:bg-[rgb(229,233,222)] rounded-xl text-xl">
            <Link to="/dashboard">Dashboard</Link>
          </li>
          <li className="cursor-pointer md:p-3 p-2 hover:bg-[rgb(229,233,222)] rounded-xl text-xl">
            <Link to="/resources">Resources</Link>
          </li>
          <h1 className="text-[10px] md:text-[12px] text-gray-500 md:mb-3" >MANAGE</h1>
          <li className="cursor-pointer md:p-3 p-2 hover:bg-[rgb(229,233,222)] rounded-xl text-xl">
            <Link to="/admin-panel">Admin panel</Link>
          </li>
          <li className="cursor-pointer md:p-3 p-2 hover:bg-[rgb(229,233,222)] rounded-xl text-xl">
            <Link to="/settings">Settings</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default SidebarNav;