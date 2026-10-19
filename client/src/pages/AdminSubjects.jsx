import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SidebarNav from '../components/SidebarNav';
import MobileNav from '../components/MobileNav';
import { useAuth } from '../context/AuthContext';
import TabBar from '../components/TabBar';
import { Link } from 'react-router-dom';
import { getAdminSubjects, addAdminSubject, updateAdminSubject, deleteAdminSubject, sendFeatureAnnouncement, advanceStudentsToNextYear, rollbackStudentsYearAdvance } from '../api/subjectsApi';
import { useTheme } from '../context/ThemeContext';

const AdminSubjects = () => {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [subject, setSubject] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [year, setYear] = useState('');
    const [category, setCategory] = useState('');
    const [editingSubjectId, setEditingSubjectId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editYear, setEditYear] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const nav = useNavigate();
    const [getSubjects, setGetSubjects] = useState([]);
    const [editFormErrorMessage, setEditFormErrorMessage] = useState('');
    const [announcementForm, setAnnouncementForm] = useState({
        featureName: '',
        featureDescription: '',
        howItWorks: '',
    });
    const [announcementLoading, setAnnouncementLoading] = useState(false);
    const [announcementMessage, setAnnouncementMessage] = useState({ type: '', text: '' });
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [showYearAdvanceModal, setShowYearAdvanceModal] = useState(false);
    const [yearAdvanceLoading, setYearAdvanceLoading] = useState(false);
    const [yearAdvanceMessage, setYearAdvanceMessage] = useState({ type: '', text: '' });

    const shellTheme = isDark ? 'bg-slate-900 text-slate-100' : 'bg-[rgb(244,247,239)] text-slate-900';
    const mutedText = isDark ? 'text-slate-300' : 'text-gray-600';
    const panelClass = isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white text-gray-900';
    const inputClass = isDark ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400' : 'border-gray-300 bg-white text-gray-900';
    const tableHeaderClass = isDark ? 'text-slate-300 border-slate-600' : 'text-gray-900 border-gray-500';
    const rowClass = isDark ? 'text-slate-200 border-slate-700' : 'text-gray-700 border-gray-500';
    const modalClass = isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-white text-gray-900';
    const modalInputClass = isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-300 bg-white text-gray-900';

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const response = await getAdminSubjects();
                setGetSubjects(response.data);
            } catch (error) {
                console.error('Error fetching subjects:', error);
                setErrorMessage(error.response?.data?.message || 'Failed to fetch subjects');
            }
        };

        fetchSubjects();
    }, []);

    const handleDelete = async (id) => {
        try {
            await deleteAdminSubject(id);
            setGetSubjects((subjects) => subjects.filter((item) => item._id !== id));
            setSuccessMessage('Subject deleted successfully');
            setErrorMessage('');
        } catch (error) {
            console.error('Error deleting subject:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to delete subject');
            setSuccessMessage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await addAdminSubject({
                name: subject,
                year,
                category,
            });
            setGetSubjects((subjects) => [...subjects, response.data]);
            setSuccessMessage('Subject added successfully');
            setErrorMessage('');
            setSubject('');
            setYear('');
            setCategory('');
        } catch (error) {
            console.error('Error adding subject:', error);
            setErrorMessage(error.response?.data?.message || 'Failed to add subject');
            setSuccessMessage('');
        }
    };

    const handleEditClick = (subjectData) => {
        setEditingSubjectId(subjectData._id);
        setEditName(subjectData.name);
        setEditYear(subjectData.year);
        setEditCategory(subjectData.category);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await updateAdminSubject(editingSubjectId, {
                name: editName,
                year: editYear,
                category: editCategory,
            });

            setGetSubjects((subjects) =>
                subjects.map((item) => (item._id === editingSubjectId ? response.data : item))
            );
            setEditFormErrorMessage('');
            setSuccessMessage('Subject updated successfully');
            setEditingSubjectId(null);
            setEditName('');
            setEditYear('');
            setEditCategory('');
        } catch (error) {
            console.error('Error updating subject:', error);
            setEditFormErrorMessage(error.response?.data?.message || 'Failed to update subject');
            setSuccessMessage('');
        }
    };

    const handleAnnouncementSubmit = async (e) => {
        e.preventDefault();
        setAnnouncementLoading(true);
        setAnnouncementMessage({ type: '', text: '' });

        try {
            const response = await sendFeatureAnnouncement(announcementForm);
            setAnnouncementMessage({
                type: 'success',
                text: response.data.message,
            });
            setAnnouncementForm({
                featureName: '',
                featureDescription: '',
                howItWorks: '',
            });
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to send the feature announcement email.';
            setAnnouncementMessage({ type: 'error', text: message });
        } finally {
            setAnnouncementLoading(false);
        }
    };

    const handleYearAdvance = async () => {
        setYearAdvanceLoading(true);
        setYearAdvanceMessage({ type: '', text: '' });

        try {
            const response = await advanceStudentsToNextYear();
            setYearAdvanceMessage({
                type: 'success',
                text: response.data.message,
            });
            setShowYearAdvanceModal(false);
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to advance students to the next academic year.';
            setYearAdvanceMessage({ type: 'error', text: message });
        } finally {
            setYearAdvanceLoading(false);
        }
    };

    const handleYearRollback = async () => {
        setYearAdvanceLoading(true);
        setYearAdvanceMessage({ type: '', text: '' });

        try {
            const response = await rollbackStudentsYearAdvance();
            setYearAdvanceMessage({
                type: 'success',
                text: response.data.message,
            });
            setShowYearAdvanceModal(false);
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to roll back the academic year change.';
            setYearAdvanceMessage({ type: 'error', text: message });
        } finally {
            setYearAdvanceLoading(false);
        }
    };

    return (
        <>
            <div className={`flex min-h-screen flex-col md:grid md:min-h-screen md:grid-cols-[16rem_minmax(0,1fr)] md:p-10 ${shellTheme}`}>
                <div className="hidden md:block md:mb-0 mb-4 md:sticky md:top-10 md:self-start">
                    <SidebarNav />
                </div>
                <MobileNav userName={user?.name} />
                <div className="md:hidden">
                    <TabBar />
                </div>
                <div className="w-full min-w-0 pb-20 pl-4 md:pb-2 md:p-0">
                    <div className="flex flex-col md:w-full md:flex-row md:items-center md:gap-x-4">
                        <h1 className={`text-3xl font-bold italic md:pb-1 md:text-4xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin Panel</h1>
                        <div className="order-3 mt-2 mb-4 flex flex-wrap items-center gap-2 md:order-2 md:ml-auto md:mt-0 md:mb-0 md:mr-8 md:shrink-0">
                            <Link to="/upload-resources" className="w-fit cursor-pointer rounded-md bg-gray-800 px-6 py-1 text-white transition-colors duration-300 hover:bg-gray-900">
                                Upload Resources
                            </Link>
                            <button
                                type="button"
                                onClick={() => setShowAnnouncementModal(true)}
                                className={`w-fit cursor-pointer rounded-md border px-6 py-1 transition-colors duration-300 ${
                                    isDark
                                        ? 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
                                        : 'border-gray-700 bg-white text-gray-800 hover:bg-gray-100'
                                }`}
                            >
                                Notify
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowYearAdvanceModal(true)}
                                className="w-fit cursor-pointer rounded-md bg-amber-500 px-6 py-1 text-white transition-colors duration-300 hover:bg-amber-600"
                            >
                                Advance Year
                            </button>
                        </div>
                    </div>
                    <p className={`text-sm md:mb-3 md:text-lg ${mutedText}`}>
                        Subjects you add or remove here control what every student sees on their dashboard.
                    </p>
                    <div className={`mt-4 flex w-48/50 flex-col rounded-lg border p-4 md:w-45/50 ${panelClass}`}>
                        <form onSubmit={handleSubmit} className="items-center gap-4 md:grid md:grid-cols-4 md:w-58/60">
                            <div className="flex flex-col">
                                <label htmlFor="subject" className={`mb-1 md:mb-2 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Subject Name</label>
                                <input type="text" id="subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter subject name" className={`rounded-lg border p-2 ${inputClass}`} required />
                            </div>
                            <div className="mt-4 flex flex-col md:ml-4 md:mt-0">
                                <label htmlFor="year" className={`mb-1 md:mb-2 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Year</label>
                                <select id="year" name="year" value={year} onChange={(e) => setYear(e.target.value)} className={`rounded-lg border p-2 ${inputClass}`} required>
                                    <option value="">Select Year</option>
                                    <option value="1">Year 1</option>
                                    <option value="2">Year 2</option>
                                    <option value="3">Year 3</option>
                                    <option value="4">Final Year</option>
                                </select>
                            </div>
                            <div className="mt-4 flex flex-col md:ml-4 md:mt-0">
                                <label htmlFor="category" className={`mb-1 md:mb-2 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Category</label>
                                <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={`rounded-lg border p-2 ${inputClass}`} required>
                                    <option value="">Select Category</option>
                                    <option value="core">Core</option>
                                    <option value="optional">optional</option>
                                </select>
                            </div>
                            <div className="mt-8 flex flex-col md:ml-4 md:p-3">
                                <button type="submit" className="cursor-pointer rounded-md bg-gray-800 p-3 text-white hover:bg-gray-900 md:my-4">Add Subject</button>
                            </div>
                        </form>
                    </div>
                    <div>
                        {errorMessage && (
                            <p className={`col-span-4 mb-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                {errorMessage}
                            </p>
                        )}
                        {successMessage && (
                            <p className={`col-span-4 mb-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                                {successMessage}
                            </p>
                        )}
                    </div>

                    <div className="w-full overflow-x-hidden text-sm md:text-md">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[400px] table-fixed border-separate border-spacing-0">
                                <thead>
                                    <tr className={`border-b pb-2 pt-4 ${tableHeaderClass}`}>
                                        <th className="min-w-0 px-0 py-2 text-left md:px-0">Subject</th>
                                        <th className="min-w-0 px-0 py-2 text-left md:px-0">Year</th>
                                        <th className="min-w-0 px-0 py-2 text-left md:px-0">Category</th>
                                        <th className="min-w-0 px-0 py-2 text-left md:px-0">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSubjects.map((item) => (
                                        <tr key={item._id} className={`border-b ${rowClass}`}>
                                            <td className="min-w-0 break-words px-0 py-3 text-left md:px-0">{item.name}</td>
                                            <td className="min-w-0 break-words px-0 py-3 text-left md:px-0">{item.year}</td>
                                            <td className="min-w-0 break-words px-0 py-3 text-left md:px-0">{item.category}</td>
                                            <td className="min-w-0 px-0 py-3 md:px-0">
                                                <div className="flex items-center gap-1.5 md:gap-2">
                                                    <button onClick={() => handleDelete(item._id)} className="cursor-pointer whitespace-nowrap">Remove</button>
                                                    <button onClick={() => handleEditClick(item)} className="cursor-pointer whitespace-nowrap">Edit</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {showYearAdvanceModal && (
                <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => setShowYearAdvanceModal(false)} />
            )}

            {showYearAdvanceModal && (
                <div className={`fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border p-6 shadow-2xl ${modalClass}`}>
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Academic year rollover</h2>
                            <p className={`mt-1 text-sm ${mutedText}`}>
                                This will move all verified and profile-complete students from Year 1 to 2, Year 2 to 3, and so on. It is allowed only from 1 July to 15 July and can be done only once per cycle.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowYearAdvanceModal(false)}
                            className={`text-xl font-medium ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            ×
                        </button>
                    </div>

                    {yearAdvanceMessage.text && (
                        <p className={`mb-4 rounded-md border px-3 py-2 text-sm ${yearAdvanceMessage.type === 'success' ? (isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700') : (isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700')}`}>
                            {yearAdvanceMessage.text}
                        </p>
                    )}

                    <div className="space-y-4">
                        <p className={`text-sm ${mutedText}`}>
                            Warning: this is a permanent rollover for the current cycle. Confirm only if the current date is inside the allowed window and you want every eligible student to move to the next year.
                        </p>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowYearAdvanceModal(false)}
                                className={`rounded-md border px-4 py-2 ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleYearAdvance}
                                disabled={yearAdvanceLoading}
                                className="rounded-md bg-amber-500 px-4 py-2 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {yearAdvanceLoading ? 'Processing...' : 'Confirm Promote'}
                            </button>
                            <button
                                type="button"
                                onClick={handleYearRollback}
                                disabled={yearAdvanceLoading}
                                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Roll Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAnnouncementModal && (
                <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => setShowAnnouncementModal(false)} />
            )}

            {showAnnouncementModal && (
                <div className={`fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border p-6 shadow-2xl ${modalClass}`}>
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notify users</h2>
                            <p className={`mt-1 text-sm ${mutedText}`}>
                                Send the feature update to all verified users with completed profiles.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAnnouncementModal(false)}
                            className={`text-xl font-medium ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="featureName" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Feature Name
                            </label>
                            <input
                                id="featureName"
                                type="text"
                                value={announcementForm.featureName}
                                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, featureName: e.target.value }))}
                                className={`rounded-lg border p-3 ${modalInputClass}`}
                                placeholder="Example: Smart AI Study Assistant"
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label htmlFor="featureDescription" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Feature Description
                            </label>
                            <textarea
                                id="featureDescription"
                                rows="4"
                                value={announcementForm.featureDescription}
                                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, featureDescription: e.target.value }))}
                                className={`rounded-lg border p-3 ${modalInputClass}`}
                                placeholder="Describe the feature and what it adds to the platform."
                                required
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <label htmlFor="howItWorks" className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                How it works and how to use it
                            </label>
                            <textarea
                                id="howItWorks"
                                rows="4"
                                value={announcementForm.howItWorks}
                                onChange={(e) => setAnnouncementForm((prev) => ({ ...prev, howItWorks: e.target.value }))}
                                className={`rounded-lg border p-3 ${modalInputClass}`}
                                placeholder="Explain what the feature does and how the user should use it."
                                required
                            />
                        </div>

                        {announcementMessage.text && (
                            <p className={`rounded-md border px-3 py-2 text-sm ${announcementMessage.type === 'success' ? (isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700') : (isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700')}`}>
                                {announcementMessage.text}
                            </p>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAnnouncementModal(false)}
                                className={`rounded-md border px-4 py-2 ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                            >
                                Close
                            </button>
                            <button
                                type="submit"
                                disabled={announcementLoading}
                                className="rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {announcementLoading ? 'Sending...' : 'Send Email'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {editingSubjectId && (
                <div className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm" onClick={() => setEditingSubjectId(null)} />
            )}

            {editingSubjectId && (
                <div className={`fixed inset-x-0 top-4 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-xl rounded-2xl border p-6 shadow-2xl ${modalClass}`}>
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Edit Subject</h2>
                        {editFormErrorMessage && (
                            <p className={`rounded-md border px-3 py-2 text-sm ${isDark ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                {editFormErrorMessage}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => setEditingSubjectId(null)}
                            className={`text-xl font-medium ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div className="flex flex-col">
                            <label htmlFor="editSubjectName" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Subject Name</label>
                            <input
                                id="editSubjectName"
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className={`rounded-lg border p-3 focus:outline-none ${modalInputClass}`}
                                required
                            />
                        </div>

                        <div className="flex flex-col">
                            <label htmlFor="editYear" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Year</label>
                            <select
                                id="editYear"
                                value={editYear}
                                onChange={(e) => setEditYear(e.target.value)}
                                className={`rounded-lg border p-3 focus:outline-none ${modalInputClass}`}
                                required
                            >
                                <option value="">Select Year</option>
                                <option value="1">Year 1</option>
                                <option value="2">Year 2</option>
                                <option value="3">Year 3</option>
                                <option value="4">Final Year</option>
                            </select>
                        </div>

                        <div className="flex flex-col">
                            <label htmlFor="editCategory" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Category</label>
                            <select
                                id="editCategory"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className={`rounded-lg border p-3 focus:outline-none ${modalInputClass}`}
                                required
                            >
                                <option value="">Select Category</option>
                                <option value="core">Core</option>
                                <option value="optional">optional</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setEditingSubjectId(null)}
                                className={`rounded-md border px-4 py-2 ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-md bg-gray-800 px-4 py-2 text-white hover:bg-gray-900"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default AdminSubjects;
