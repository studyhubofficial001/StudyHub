import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import SidebarNav from "../components/SidebarNav";
import MobileNav from "../components/MobileNav";
import { useNavigate } from "react-router-dom";
import TabBar from "../components/TabBar";
import { getUserSubjects } from "../api/subjectsApi";
import { getUserResources } from "../api/resourcesApi";
import { getCurrentSyllabusDownloadUrl } from "../api/syllabusApi";
import { getChatStats } from "../api/aiApi";
import { useTheme } from "../context/ThemeContext";

const Dashboard = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [subjects, setSubjects] = useState([]);
  const [chatStats, setChatStats] = useState(null);
  const [syllabusName, setSyllabusName] = useState("Global Syllabus");
  const navigate = useNavigate();
  const [totalResources, setTotalResources] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    const fetchSubjects = async () => {
      try {
        const response = await getUserSubjects();
        const fetchedSubjects = response.data || [];
        setSubjects(fetchedSubjects);
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    const fetchResources = async () => {
      try {
        const response = await getUserResources();
        setTotalResources(response.data?.length || 0);
      } catch (error) {
        console.error("Error fetching resources:", error);
      }
    };

    const fetchSyllabus = async () => {
      try {
        const response = await getCurrentSyllabusDownloadUrl();
        if (response?.data?.originalName) {
          setSyllabusName(response.data.originalName);
        }
      } catch (error) {
        console.error("Error fetching syllabus:", error);
      }
    };

    const fetchChatStats = async () => {
      try {
        setChatStats(await getChatStats());
      } catch (error) {
        console.error("Error fetching dashboard chat stats:", error);
      }
    };

    fetchSubjects();
    fetchResources();
    fetchSyllabus();
    fetchChatStats();

    return () => clearInterval(interval);
  }, []);

  const hour = currentTime.getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "Good Morning"
      : hour >= 12 && hour < 17
        ? "Good Afternoon"
        : hour >= 17 && hour < 20
          ? "Good Evening"
          : "Good Night";
  const fixedYear = user?.year ? user.year === 1 ? "1st Year" : user.year === 2 ? "2nd Year" : user.year === 3 ? "3rd Year" : user.year === 4 ? "4th Year" : "" : "";
  const fixedname = user?.name ? user.name[0].toUpperCase() + user.name.slice(1) : "User";
  const shellTheme = isDark ? "bg-slate-900 text-slate-100" : "bg-[rgb(244,247,239)] text-slate-900";
  const mutedText = isDark ? "text-slate-300" : "text-gray-600";
  const statCard = isDark ? "border-slate-700 bg-slate-800/80" : "border-gray-500 bg-white";
  const chipClass = isDark ? "border-slate-600 text-slate-200 hover:bg-slate-700" : "border-gray-400 text-gray-700 hover:bg-gray-800 hover:text-white";
  const subjectCard = isDark ? "border-slate-700 bg-slate-600 hover:bg-slate-800/80" : "border-gray-500 bg-white hover:bg-gray-100";
  const subjectBadge = isDark ? "bg-slate-700 text-slate-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200";
  const subjectIds = new Set(subjects.map((subject) => String(subject._id)));
  const exploredSubjects = new Set(
    (chatStats?.exploredSubjectIds || []).filter((id) => subjectIds.has(String(id))).map(String)
  ).size;
  const syllabusCoverage = subjects.length
    ? Math.round((exploredSubjects / subjects.length) * 100)
    : null;

  const handleOpenSyllabus = async () => {
    try {
      const response = await getCurrentSyllabusDownloadUrl();
      const syllabusUrl = response?.data?.downloadUrl;

      if (!syllabusUrl) {
        return;
      }

      window.open(syllabusUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error opening syllabus:", error);
    }
  };

  return (
    <div className={`flex min-h-screen flex-col md:grid md:min-h-screen md:grid-cols-[16rem_minmax(0,1fr)] md:p-10 md:mb-0 mb-10 ${shellTheme}`}>
      <div className="hidden md:block md:mr-2 md:mb-0 mb-4 md:sticky md:top-10 md:self-start">
        <SidebarNav />
      </div>
      <MobileNav userName={user?.name} />
      <div className="md:hidden">
        <TabBar />
      </div>
      <div className="w-full min-w-0 p-4 md:p-0">
        <div className="flex flex-col md:w-full md:flex-row md:flex-wrap md:items-center md:gap-x-4">
          <h1 className={`order-1 text-2xl font-bold italic md:flex-1 md:pb-1 md:text-3xl ${isDark ? "text-white" : "text-gray-900"}`}>
            {greeting}, {fixedname}
          </h1>
          <button
            type="button"
            onClick={() => navigate('/ask-ai')}
            className="order-3 mt-2 mb-4 w-fit cursor-pointer rounded-md bg-gray-800 px-6 py-1 text-white transition-colors duration-300 hover:bg-gray-900 md:order-2 md:ml-auto md:mt-0 md:mb-0 md:mr-8 md:shrink-0"
          >
            Ask AI
          </button>
          <p className={`order-2 text-sm md:order-3 md:basis-full md:text-md md:mb-3 ${mutedText}`}>
            {fixedYear}-BCA. here is what's moving in your subjects.
          </p>
        </div>

        <div className="grid w-full grid-rows-3 gap-4 md:grid-cols-3 md:grid-rows-1 md:pr-0">
          <div className={`col-span-3 p-2 row-span-3 rounded-lg border md:col-span-1 md:h-20 ${statCard}`}>
            <h1 className="px-5 pt-2 font-serif text-xl md:pt-3 md:text-2xl">{totalResources}</h1>
            <p className={`px-5 text-sm ${mutedText}`}>Resources you can access</p>
          </div>
          <div className={`col-span-3 p-2 row-span-3 rounded-lg border md:col-span-1 md:h-20 ${statCard}`}>
            <h1 className="px-5 pt-2 font-serif text-xl md:pt-3 md:text-2xl">
              {chatStats ? chatStats.questionsAsked : "—"}
            </h1>
            <p className={`px-5 text-sm ${mutedText}`}>Questions asked to RAG</p>
          </div>
          <div className={`col-span-3 p-2 row-span-3 rounded-lg border md:col-span-1 md:h-20 ${statCard}`}>
            <h1 className="px-5 pt-2 font-serif text-xl md:pt-3 md:text-2xl">
              {syllabusCoverage === null ? "—" : `${syllabusCoverage}%`}
            </h1>
            <p className={`px-5 text-sm ${mutedText}`}>
              Subjects explored via RAG — {exploredSubjects} of {subjects.length}
            </p>
          </div>
        </div>

        <div className={`mt-4 flex flex-row gap-2 text-[12px] md:gap-4 md:text-sm ${mutedText}`}>
          <button
            type="button"
            onClick={() => navigate('/resources')}
            className={`rounded-2xl border px-2 py-1 transition-colors duration-400 ${chipClass}`}
          >
            Browse Resources
          </button>
          {/* <button className={`rounded-2xl border px-3 py-1 transition-colors duration-400 ${chipClass}`}>
            Code Editor
          </button> */}
          {/* <button className={`rounded-2xl border px-2 py-1 transition-colors duration-400 ${chipClass}`}>
            AI Agent
          </button> */}
        </div>

        <button
          type="button"
          onClick={handleOpenSyllabus}
          className={`mt-4 w-full rounded-2xl border p-4 text-left shadow-sm transition-colors duration-200 cursor-pointer md:p-5 ${subjectCard} hover:opacity-95`}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-2xl shadow-sm">
              📚
            </div>
            <div className="min-w-0 flex-1">
              <h2 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                Your Syllabus
              </h2>
              <p className={`text-sm ${mutedText}`}>
                View and download the shared syllabus for all students.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className={`truncate rounded-full border px-3 py-1 text-xs font-medium ${isDark ? "border-slate-600 bg-slate-700 text-slate-200" : "border-gray-300 bg-gray-100 text-gray-700"}`}>
              {syllabusName}
            </span>
            <span className={`text-xs font-medium ${isDark ? "text-slate-300" : "text-gray-600"}`}>
              Open PDF →
            </span>
          </div>
        </button>

        <div className="mb-2 mt-4 text-sm md:mb-4 md:mt-5 md:text-md">
          <h1 className={`font-bold ${isDark ? "text-slate-200" : "text-gray-700"}`}>YOUR SUBJECTS</h1>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-3 md:grid-rows-1">
            {subjects.map((subject) => (
              <div
                key={subject._id}
                className={`cursor-pointer rounded-lg rounded-tl-none border p-4 transition-colors duration-200 ${subjectCard}`}
                onClick={() =>
                  navigate({
                    pathname: "/resources",
                    search: `?subject=${subject._id}`,
                    state: { selectedSubject: subject._id },
                  })
                }
              >
                <h2 className="mb-2 text-lg font-bold">{subject.name}</h2>
                <span className={`rounded-lg px-2 pb-1 font-semibold ${subjectBadge}`}>{subject.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;