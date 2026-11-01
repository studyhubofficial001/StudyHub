import { Link } from "react-router-dom";
import SidebarNav from "../components/SidebarNav";
import MobileNav from "../components/MobileNav";
import TabBar from "../components/TabBar";
import IngestionMonitor from "../components/IngestionMonitor";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useState, useEffect, useRef } from "react";
import { getAdminSubjects } from "../api/subjectsApi";
import {
    getAdminResources,
    createAdminResource,
    updateAdminResource,
    deleteAdminResource,
    getResourceDownloadUrl,
} from "../api/resourcesApi";

const UploadResources = () => {
    const {
        user,
        uploadedResources,
        setUploadedResources,
    } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [subjectName, setSubjectName] = useState([]);
    const [subjectYear, setSubjectYear] = useState([]);
    const [subjectCategory, setSubjectCategory] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [resourceEditForm, setResourceEditForm] = useState({
        title: '',
        subject: '',
        year: '',
        category: '',
        resourceType: 'resource',
    });
    const [resourceEditError, setResourceEditError] = useState('');
    const [isUpdatingResource, setIsUpdatingResource] = useState(false);
    const notificationTimeoutRef = useRef(null);

    const uniqueYears = [...new Set(subjectYear)];
    const uniqueCategories = [...new Set(subjectCategory)];
    const uniqueSubjects = [...new Set(subjectName.map(subject => subject.name))].map(name => {
        return subjectName.find(subject => subject.name === name);
    });

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

    const openResource = async (resourceId) => {
        const downloadWindow = window.open('about:blank', '_blank');
        if (!downloadWindow) {
            window.alert('Allow pop-ups to open resource downloads.');
            return;
        }

        downloadWindow.opener = null;
        try {
            const response = await getResourceDownloadUrl(resourceId);
            downloadWindow.location.href = response.data.downloadUrl;
        } catch (error) {
            console.error('Error fetching download URL:', error);
            downloadWindow.close();
            showNotification('error', error.response?.data?.message || 'Failed to open resource');
        }
    };

    useEffect(() => {
        const getSubjects = async () => {
            try {
                const response = await getAdminSubjects();
                setSubjectName(response.data);
                setSubjectYear(response.data.map(subject => subject.year));
                setSubjectCategory(response.data.map(subject => subject.category));
            } catch (error) {
                console.error('Error fetching subjects:', error);
                showNotification('error', error.response?.data?.message || 'Failed to fetch subjects');
            }
        };

        getSubjects();
    }, []);

    const getResources = async () => {
        try {
            const response = await getAdminResources();
            const resources = response.data;
            setUploadedResources(resources);
        } catch (error) {
            console.error('Error fetching resources:', error);
            showNotification('error', error.response?.data?.message || 'Failed to fetch resources');
        }
    };

    useEffect(() => {
        getResources();
    }, []);

    const HandleDeleteResource = async (resourceId) => {
        try {
            await deleteAdminResource(resourceId);
            setUploadedResources(uploadedResources.filter(resource => resource._id !== resourceId));
            showNotification('success', 'Resource deleted successfully!');
        } catch (error) {
            console.error('Error deleting resource:', error);
            showNotification('error', error.response?.data?.message || 'Failed to delete resource');
        }
    };

    const handleEditResourceOpen = (resource) => {
        const subjectMatch = subjectName.find((subject) => subject.name === resource.subject);

        setEditingResource(resource);
        setResourceEditForm({
            title: resource.title || '',
            subject: resource.subject || '',
            year: String(resource.year || subjectMatch?.year || ''),
            category: resource.category || subjectMatch?.category || '',
            resourceType: resource.resourceType || 'resource',
        });
        setResourceEditError('');
    };

    const handleResourceEditChange = (event) => {
        const { name, value } = event.target;

        if (name === 'subject') {
            const subjectMatch = subjectName.find((subject) => subject.name === value);

            setResourceEditForm((previousForm) => ({
                ...previousForm,
                subject: value,
                year: subjectMatch ? String(subjectMatch.year) : previousForm.year,
                category: subjectMatch ? subjectMatch.category : previousForm.category,
            }));
            return;
        }

        setResourceEditForm((previousForm) => ({
            ...previousForm,
            [name]: value,
        }));
    };

    const handleResourceEditSubmit = async (event) => {
        event.preventDefault();

        const selectedSubject = subjectName.find((subject) => subject.name === resourceEditForm.subject);

        if (!resourceEditForm.title.trim()) {
            setResourceEditError('Resource title is required');
            return;
        }

        if (!selectedSubject) {
            setResourceEditError('Please select a valid subject from the list');
            return;
        }

        if (String(resourceEditForm.year) !== String(selectedSubject.year) || resourceEditForm.category !== selectedSubject.category) {
            setResourceEditError('The selected subject, year, and category must match an existing subject combination');
            return;
        }

        setIsUpdatingResource(true);
        setResourceEditError('');

        try {
            const response = await updateAdminResource(editingResource._id, resourceEditForm);
            setUploadedResources((previousResources) =>
                previousResources.map((resource) =>
                    resource._id === editingResource._id ? { ...resource, ...response.data.resource } : resource
                )
            );
            setEditingResource(null);
            setResourceEditForm({ title: '', subject: '', year: '', category: '', resourceType: 'resource' });
            showNotification('success', 'Resource updated successfully!');
        } catch (error) {
            console.error('Error updating resource:', error);
            setResourceEditError(error.response?.data?.message || 'Failed to update resource');
            showNotification('error', error.response?.data?.message || 'Failed to update resource');
        } finally {
            setIsUpdatingResource(false);
        }
    };

    const HandleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.target);
        try {
            const response = await createAdminResource(formData);
            showNotification('success', 'Resource uploaded successfully!');
            console.log('Resource uploaded successfully:', response.data);
            await getResources();
        } catch (error) {
            console.error('Error uploading resource:', error);
            showNotification('error', error.response?.data?.message || 'Failed to upload resource');
        }
        setIsSubmitting(false);
    };

    const shellTheme = isDark ? 'bg-slate-900 text-slate-100' : 'bg-[rgb(244,247,239)] text-slate-900';
    const panelClass = isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-white text-gray-900';
    const mutedText = isDark ? 'text-slate-300' : 'text-gray-600';
    const inputClass = isDark ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-400' : 'border-gray-300 bg-gray-100 text-gray-900';
    const tableHead = isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500';
    const modalClass = isDark ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-gray-200 bg-white text-gray-900';
    const modalPanel = isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50';
    const modalField = isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-gray-300 bg-white text-gray-900';

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
                <div className="flex flex-col gap-3 md:w-full md:flex-row md:items-center md:gap-x-4">
                    <h1 className={`text-3xl font-bold italic md:pb-1 md:text-4xl ${isDark ? 'text-white' : 'text-gray-900'}`}>Upload Resources</h1>
                    <Link
                        to="/upload-syllabus"
                        className="order-3 mt-2 w-fit rounded-md bg-teal-700 px-6 py-1 text-white transition-colors duration-300 hover:bg-teal-600 md:order-2 md:ml-auto md:mt-0 md:shrink-0"
                    >
                        Upload Syllabus
                    </Link>
                </div>
                <p className={`text-sm md:mb-3 md:text-lg ${mutedText}`}>Upload resources for students to access.</p>
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
                    <form onSubmit={HandleSubmit} className="items-center gap-6 md:grid md:grid-cols-3 md:w-full">
                        <div className="mb-4 md:mt-0">
                            <label htmlFor="title" className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Resource Title
                            </label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`}
                                placeholder="Enter resource title"
                            />
                        </div>
                        <div>
                            <label htmlFor="subjectName" className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Subject Name
                            </label>
                            <select id="subject" name="subject" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`}>
                                <option>Select Subject</option>
                                {uniqueSubjects.map((subject) => (
                                    <option key={subject._id} value={subject.name}>
                                        {subject.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4 md:mt-0">
                            <label className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Subject Year
                            </label>
                            <select id="year" name="year" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`}>
                                <option>Select Year</option>
                                {uniqueYears.map((year, index) => (
                                    <option key={index} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4 md:mt-0">
                            <label className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Subject Category
                            </label>
                            <select id="category" name="category" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`}>
                                <option>Select Category</option>
                                {uniqueCategories.map((category, index) => (
                                    <option key={index} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="mt-4 md:mt-0">
                            <label htmlFor="resourceType" className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                File Type
                            </label>
                            <select id="resourceType" name="resourceType" defaultValue="resource" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`}>
                                <option value="resource">Study resource</option>
                                <option value="pyq">Previous year question paper (PYQ)</option>
                                <option value="code">Code file</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="resourceFile" className={`mt-4 block text-sm font-medium md:mt-0 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Upload File
                            </label>
                                            <input type="file" id="file" name="file" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`} />
                        </div>
                        <div className="mt-6 flex justify-center md:col-span-3">
                            <button type="submit" className="w-full cursor-pointer rounded-md bg-slate-800 px-6 py-2 text-white transition-colors duration-200 hover:bg-slate-700 md:w-50">
                                {isSubmitting ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </form>
                </div>
                <IngestionMonitor isDark={isDark} />
                {uploadedResources.length > 0 && (
                    <div className={`relative mt-4 flex w-full max-w-full flex-col overflow-hidden rounded-lg border p-4 ${panelClass}`}>
                        <h2 className={`mb-4 text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Uploaded Resources</h2>
                        <div className="overflow-hidden">
                            <table className="w-full table-fixed border-separate border-spacing-0 divide-y divide-gray-200">
                                <thead className={tableHead}>
                                    <tr>
                                        <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">
                                            Title
                                        </th>
                                        <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">
                                            Subject
                                        </th>
                                        <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">
                                            Year
                                        </th>
                                        <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">
                                            File Type
                                        </th>
                                        <th className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:py-3">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y divide-gray-200 text-[15px] md:text-sm ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700'}`}>
                                    {uploadedResources.map((resource) => {
                                        return (
                                            <tr key={resource._id} className="align-top">
                                                <td className="px-2 py-2 md:px-6 md:py-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => openResource(resource._id)}
                                                        className="block break-all text-left text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {resource.title}
                                                    </button>
                                                </td>
                                                <td className="px-2 py-2 break-all md:px-6 md:py-4">
                                                    {resource.subject}
                                                </td>
                                                <td className="px-2 py-2 break-all md:px-6 md:py-4">
                                                    {resource.year}
                                                </td>
                                                <td className="px-2 py-2 md:px-6 md:py-4">
                                                    {resource.resourceType === 'pyq' ? 'PYQ' : resource.resourceType === 'code' ? 'Code' : 'Study resource'}
                                                </td>
                                                <td className="px-2 py-2 md:px-6 md:py-4">
                                                    <div className="flex flex-wrap items-center gap-2 md:gap-5">
                                                        <button type="button" onClick={() => handleEditResourceOpen(resource)} className="cursor-pointer text-blue-600 hover:text-blue-800">
                                                            Edit
                                                        </button>
                                                        <button type="button" onClick={() => HandleDeleteResource(resource._id)} className="cursor-pointer text-red-500 hover:text-red-400">
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

            {editingResource && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
                        onClick={() => setEditingResource(null)}
                    />
                    <div className="relative z-50 flex min-h-full items-start justify-center p-3 sm:p-6">
                        <div className={`mt-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-6 ${modalClass}`}>
                            <div className="mb-5 flex items-center justify-between gap-4">
                                <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Edit Resource</h2>
                                <button
                                    type="button"
                                    onClick={() => setEditingResource(null)}
                                    className={`text-xl font-medium ${isDark ? 'text-slate-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    ×
                                </button>
                            </div>

                            <div className={`mb-5 flex items-center justify-between gap-3 rounded-xl border p-3 ${modalPanel}`}>
                                <span className={`min-w-0 break-all text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                    {editingResource.originalName}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => openResource(editingResource._id)}
                                    className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800"
                                >
                                    Open resource
                                </button>
                            </div>

                            {resourceEditError && (
                                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                                    {resourceEditError}
                                </div>
                            )}

                            <form onSubmit={handleResourceEditSubmit} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="flex flex-col md:col-span-2">
                                        <label htmlFor="editResourceTitle" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Resource Title</label>
                                        <input
                                            id="editResourceTitle"
                                            type="text"
                                            name="title"
                                            value={resourceEditForm.title}
                                            onChange={handleResourceEditChange}
                                            className={`rounded-lg border p-3 focus:outline-none ${modalField}`}
                                            required
                                        />
                                    </div>

                                    <div className="flex flex-col">
                                        <label htmlFor="editResourceSubject" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Subject</label>
                                        <select
                                            id="editResourceSubject"
                                            name="subject"
                                            value={resourceEditForm.subject}
                                            onChange={handleResourceEditChange}
                                            className={`rounded-lg border p-3 focus:outline-none ${modalField}`}
                                            required
                                        >
                                            <option value="">Select Subject</option>
                                            {uniqueSubjects.filter(Boolean).map((subject) => (
                                                <option key={subject._id} value={subject.name}>
                                                    {subject.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col">
                                        <label htmlFor="editResourceYear" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Year</label>
                                        <select
                                            id="editResourceYear"
                                            name="year"
                                            value={resourceEditForm.year}
                                            onChange={handleResourceEditChange}
                                            className={`rounded-lg border p-3 focus:outline-none ${modalField}`}
                                            required
                                        >
                                            <option value="">Select Year</option>
                                            {uniqueYears.map((year) => (
                                                <option key={year} value={year}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col md:col-span-2">
                                        <label htmlFor="editResourceCategory" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Category</label>
                                        <select
                                            id="editResourceCategory"
                                            name="category"
                                            value={resourceEditForm.category}
                                            onChange={handleResourceEditChange}
                                            className={`rounded-lg border p-3 focus:outline-none ${modalField}`}
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            {uniqueCategories.map((category) => (
                                                <option key={category} value={category}>
                                                    {category}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col md:col-span-2">
                                        <label htmlFor="editResourceType" className={`mb-1 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>File Type</label>
                                        <select
                                            id="editResourceType"
                                            name="resourceType"
                                            value={resourceEditForm.resourceType}
                                            onChange={handleResourceEditChange}
                                            className={`rounded-lg border p-3 focus:outline-none ${modalField}`}
                                            required
                                        >
                                            <option value="resource">Study resource</option>
                                            <option value="pyq">Previous year question paper (PYQ)</option>
                                            <option value="code">Code file</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditingResource(null)}
                                        className={`rounded-md border px-4 py-2 ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isUpdatingResource}
                                        className="rounded-md bg-slate-800 px-4 py-2 text-white transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {isUpdatingResource ? 'Saving...' : 'Save Changes'}
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

export default UploadResources;