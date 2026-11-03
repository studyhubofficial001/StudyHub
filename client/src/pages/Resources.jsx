import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import TabBar from "../components/TabBar";
import SidebarNav from "../components/SidebarNav";
import MobileNav from "../components/MobileNav";
import { getUserSubjects } from "../api/subjectsApi";
import { getUserResources, getUserResourceDownloadUrl } from "../api/resourcesApi";
import fileIcon from "../assets/file_icon.jpg";
import { useTheme } from "../context/ThemeContext";

const Resources = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const location = useLocation();
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);
  const initialSubject = new URLSearchParams(location.search).get('subject') || location.state?.selectedSubject || 'all';
  const [selectedFilter, setSelectedFilter] = useState(initialSubject);
  const [loading, setLoading] = useState(false);

  const shellTheme = isDark ? "bg-slate-900 text-slate-100" : "bg-[rgb(244,247,239)] text-slate-900";
  const mutedText = isDark ? "text-slate-300" : "text-gray-600";
  const filterDefault = isDark ? "border-slate-600 text-slate-200" : "border-gray-400 text-black";
  const resourceCard = isDark ? "border-slate-700 bg-slate-800" : "border-gray-200 bg-white";

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const response = await getUserSubjects();
        setSubjects(response.data || []);

        const paramsSubject = new URLSearchParams(location.search).get('subject');
        const stateSubject = location.state?.selectedSubject;

        if (paramsSubject) {
          setSelectedFilter(paramsSubject);
        } else if (stateSubject) {
          setSelectedFilter(stateSubject);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
      }
    };

    fetchSubjects();
  }, [location.search, location.state?.selectedSubject]);

  useEffect(() => {
    const fetchResources = async () => {
      if (!user?.year) return;

      setLoading(true);
      try {
        const response = await getUserResources();
        setResources(response.data || []);
      } catch (error) {
        console.error("Error fetching resources:", error);
        setResources([]);
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [user?.year]);

  const visibleResources = selectedFilter === 'all'
    ? resources
    : resources.filter((resource) => resource.subject === subjects.find((subject) => subject._id === selectedFilter)?.name);

  const getFreshDownloadUrl = async (resourceId) => {
    const response = await getUserResourceDownloadUrl(resourceId);
    return response.data.downloadUrl;
  };

  const openResource = async (resource) => {
    const downloadWindow = window.open('about:blank', '_blank');
    if (!downloadWindow) {
      window.alert('Allow pop-ups to open resource downloads.');
      return;
    }

    downloadWindow.opener = null;
    try {
      downloadWindow.location.href = await getFreshDownloadUrl(resource._id);
    } catch (error) {
      console.error("Error opening resource:", error);
      downloadWindow.close();
      window.alert('Unable to open this resource. Please try again.');
    }
  };

  return (
    <div className={`flex min-h-screen flex-col md:grid md:h-screen md:min-h-0 md:grid-cols-[16rem_minmax(0,1fr)] md:p-10 md:mb-0 mb-10 ${shellTheme}`}>
      <div className="hidden md:block md:mr-2 md:mb-0 mb-4 md:sticky md:top-10 md:self-start">
        <SidebarNav />
      </div>
      <MobileNav userName={user?.name} />
      <div className="md:hidden">
        <TabBar />
      </div>
      <div className="w-full min-w-0 overflow-y-auto p-4 md:h-[calc(100vh-5rem)] md:p-0 md:pr-2">
        <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Resources</h1>
        <div className="mb-3">
          {selectedFilter === 'all' ? (
            <p className={mutedText}>Displaying resources for all subjects.</p>
          ) : (
            <p className={mutedText}>
              Displaying resources for subject:{" "}
              {subjects.find((s) => s._id === selectedFilter)?.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`rounded-2xl border px-3 py-1 text-sm font-medium transition-colors duration-200 ${
              selectedFilter === 'all'
                ? 'border-gray-800 bg-gray-800 text-white'
                : filterDefault
            }`}
          >
            All
          </button>
          {subjects.map((subject) => {
            const isSelected = selectedFilter === subject._id;

            return (
              <button
                key={subject._id}
                type="button"
                onClick={() => setSelectedFilter(subject._id)}
                className={`rounded-2xl border px-4 py-1 text-sm font-medium transition-colors duration-200 ${
                  isSelected
                    ? 'border-gray-800 bg-gray-800 text-white'
                    : filterDefault
                }`}
              >
                {subject.name}
              </button>
            );
          })}
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className={mutedText}>Loading resources...</p>
          ) : visibleResources.length === 0 ? (
            <p className={mutedText}>No resources available for this year and filter.</p>
          ) : (
            visibleResources.map((resource) => {
              return (
                <div key={resource._id} className={`rounded-xl border p-4 shadow-sm ${resourceCard}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={fileIcon}
                        alt="Resource file icon"
                        className="h-10 w-10 rounded-md object-cover shadow-sm"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => openResource(resource)}
                          className="block max-w-full truncate text-left text-md md:text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {resource.title}
                        </button>
                        <p className={mutedText}>
                          {resource.subject} • Year {resource.year} • {resource.category}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openResource(resource)}
                      className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
                    >
                      Download
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Resources;
