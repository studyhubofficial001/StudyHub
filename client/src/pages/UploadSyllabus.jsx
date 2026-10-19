import { Link } from 'react-router-dom';
import SidebarNav from '../components/SidebarNav';
import MobileNav from '../components/MobileNav';
import TabBar from '../components/TabBar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect, useRef } from 'react';
import {
  getAdminSyllabi,
  createAdminSyllabus,
  updateAdminSyllabus,
  deleteAdminSyllabus,
  getSyllabusDownloadUrl,
} from '../api/syllabusApi';

const UploadSyllabus = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [syllabi, setSyllabi] = useState([]);
  const [downloadUrls, setDownloadUrls] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState(null);
  const notificationTimeoutRef = useRef(null);

  const showNotification = (type, message) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }

    if (type === 'error') {
      setSuccessMessage('');
      setErrorMessage(message);
    } else {
      setErrorMessage('');
      setSuccessMessage(message);
    }

    notificationTimeoutRef.current = setTimeout(() => {
      setErrorMessage('');
      setSuccessMessage('');
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const getDownloadUrl = async (syllabusId) => {
    try {
      const response = await getSyllabusDownloadUrl(syllabusId);
      setDownloadUrls((previousState) => ({
        ...previousState,
        [syllabusId]: response.data.downloadUrl,
      }));
      return response.data.downloadUrl;
    } catch (error) {
      console.error('Error fetching syllabus download URL:', error);
      showNotification('error', error.response?.data?.message || 'Failed to fetch syllabus download URL');
      return null;
    }
  };

  const fetchSyllabi = async () => {
    try {
      const response = await getAdminSyllabi();
      const syllabusList = response.data || [];
      setSyllabi(syllabusList);

      const urls = {};
      await Promise.all(
        syllabusList.map(async (syllabus) => {
          const downloadUrl = await getDownloadUrl(syllabus._id);
          if (downloadUrl) {
            urls[syllabus._id] = downloadUrl;
          }
        })
      );

      setDownloadUrls(urls);
    } catch (error) {
      console.error('Error fetching syllabi:', error);
      showNotification('error', error.response?.data?.message || 'Failed to fetch syllabi');
    }
  };

  useEffect(() => {
    fetchSyllabi();
  }, []);

  const handleDeleteSyllabus = async (syllabusId) => {
    try {
      await deleteAdminSyllabus(syllabusId);
      setSyllabi((previous) => previous.filter((item) => item._id !== syllabusId));
      setDownloadUrls((previousState) => {
        const nextState = { ...previousState };
        delete nextState[syllabusId];
        return nextState;
      });
      showNotification('success', 'Syllabus deleted successfully!');
    } catch (error) {
      console.error('Error deleting syllabus:', error);
      showNotification('error', error.response?.data?.message || 'Failed to delete syllabus');
    }
  };

  const handleReplaceSyllabus = async (event) => {
    event.preventDefault();

    if (!editingSyllabus) {
      return;
    }

    const fileInput = event.target.file;
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      showNotification('error', 'Please select a PDF file to replace the syllabus');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    setIsReplacing(true);

    try {
      await updateAdminSyllabus(editingSyllabus._id, formData);
      await fetchSyllabi();
      setEditingSyllabus(null);
      event.target.reset();
      showNotification('success', 'Syllabus replaced successfully!');
    } catch (error) {
      console.error('Error replacing syllabus:', error);
      showNotification('error', error.response?.data?.message || 'Failed to replace syllabus');
    } finally {
      setIsReplacing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.target);

    try {
      await createAdminSyllabus(formData);
      event.target.reset();
      await fetchSyllabi();
      showNotification('success', 'Syllabus uploaded successfully!');
    } catch (error) {
      console.error('Error uploading syllabus:', error);
      showNotification('error', error.response?.data?.message || 'Failed to upload syllabus');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewUrl = editingSyllabus ? downloadUrls[editingSyllabus._id] : '';
  const shellTheme = isDark ? 'bg-slate-900 text-slate-100' : 'bg-[rgb(244,247,239)] text-slate-900';
  const panelClass = isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-white text-gray-900';
  const mutedText = isDark ? 'text-slate-300' : 'text-gray-600';
  const inputClass = isDark ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400' : 'border-gray-300 bg-gray-100 text-gray-900';
  const tableHead = isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500';
  const modalClass = isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-white text-gray-900';
  const modalPanel = isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50';

  return (
    <div className={`flex min-h-screen flex-col overflow-x-hidden md:grid md:min-h-screen md:grid-cols-[16rem_minmax(0,1fr)] md:p-10 ${shellTheme}`}>
      <div className="hidden md:block md:mr-2 md:mb-0 mb-4 md:sticky md:top-10 md:self-start">
        <SidebarNav />
      </div>
      <MobileNav userName={user?.name} />
      <div className="md:hidden">
        <TabBar />
      </div>

      <div className="w-full min-w-0 overflow-hidden pl-4 pb-2 md:p-0">
        <div className="flex flex-col gap-3 md:w-full md:flex-row md:items-center md:gap-x-4">
          <h1 className={`text-3xl font-bold italic md:pb-1 md:text-4xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Upload Syllabus</h1>
          <Link
            to="/upload-resources"
            className="order-3 mt-2 w-fit rounded-md bg-gray-800 px-6 py-1 text-white transition-colors duration-300 hover:bg-gray-900 md:order-2 md:ml-auto md:mt-0 md:shrink-0"
          >
            Upload Resources
          </Link>
        </div>

        <p className={`text-sm md:mb-3 md:text-lg ${mutedText}`}>
          This is the shared syllabus document for all students, covering all subjects in one PDF.
        </p>

        {errorMessage && (
          <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {successMessage}
          </div>
        )}

        <div className={`mt-4 flex w-full max-w-full flex-col rounded-lg border p-4 ${panelClass}`}>
          <form onSubmit={handleSubmit} className="items-center gap-6 md:w-full">
            <div>
              <label htmlFor="file" className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                Upload Global Syllabus PDF
              </label>
              <input type="file" id="file" name="file" accept="application/pdf" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`} required />
            </div>

            <div className="mt-6 flex justify-center">
              <button type="submit" className="w-full cursor-pointer rounded-md bg-slate-800 px-6 py-2 text-white transition-colors duration-200 hover:bg-slate-700 md:w-52" disabled={isSubmitting}>
                {isSubmitting ? 'Uploading...' : 'Upload Syllabus'}
              </button>
            </div>
          </form>
        </div>

        {syllabi.length > 0 && (
          <div className={`relative mt-4 flex w-full max-w-full flex-col overflow-hidden rounded-lg border p-4 ${panelClass}`}>
            <h2 className={`mb-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Current Syllabus</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-separate border-spacing-0 divide-y divide-gray-200">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">File</th>
                    <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-gray-200 text-[15px] md:text-sm ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700'}`}>
                  {syllabi.map((syllabus) => {
                    const pdfUrl = downloadUrls[syllabus._id];

                    return (
                      <tr key={syllabus._id} className="align-top">
                        <td className="px-2 py-2 md:px-6 md:py-4">
                          <div className="min-w-0">
                            {pdfUrl ? (
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block break-all text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {syllabus.originalName}
                              </a>
                            ) : (
                              <span className="block break-all">{syllabus.originalName}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 md:px-6 md:py-4">
                          <div className="flex flex-wrap items-center gap-2 md:gap-5">
                            <button type="button" onClick={() => setEditingSyllabus(syllabus)} className="cursor-pointer text-blue-600 hover:text-blue-800">
                              Replace
                            </button>
                            <button type="button" onClick={() => handleDeleteSyllabus(syllabus._id)} className="cursor-pointer text-red-500 hover:text-red-400">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editingSyllabus && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => setEditingSyllabus(null)} />
          <div className="relative z-50 flex min-h-full items-start justify-center p-3 sm:p-6">
            <div className={`mt-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-6 ${modalClass}`}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Replace Syllabus</h2>
                <button
                  type="button"
                  onClick={() => setEditingSyllabus(null)}
                  className={`text-xl font-medium ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  ×
                </button>
              </div>

              <div className={`mb-5 overflow-hidden rounded-xl border p-3 ${modalPanel}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Current file preview</span>
                  {previewUrl && (
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:text-blue-800">
                      Open file
                    </a>
                  )}
                </div>

                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="Current syllabus preview"
                    className="h-[260px] w-full rounded-lg border-0 sm:h-[420px]"
                    loading="lazy"
                  />
                ) : (
                  <div className={`flex h-[180px] items-center justify-center rounded-lg border border-dashed text-sm ${isDark ? 'border-slate-600 bg-slate-900 text-slate-300' : 'border-gray-300 bg-white text-gray-500'}`}>
                    No preview available for this file.
                  </div>
                )}
              </div>

              <form onSubmit={handleReplaceSyllabus} className="space-y-4">
                <div>
                  <label htmlFor="replaceSyllabusFile" className={`mb-1 block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                    Upload new PDF
                  </label>
                  <input
                    id="replaceSyllabusFile"
                    name="file"
                    type="file"
                    accept="application/pdf"
                    className={`mt-1 block w-full rounded-lg border p-3 ${isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-300 bg-white text-gray-900'}`}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingSyllabus(null)}
                    className={`rounded-md border px-4 py-2 ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isReplacing}
                    className="rounded-md bg-slate-800 px-4 py-2 text-white transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isReplacing ? 'Replacing...' : 'Replace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadSyllabus;
