import { Link } from "react-router-dom";
import SidebarNav from "../components/SidebarNav";
import MobileNav from "../components/MobileNav";
import TabBar from "../components/TabBar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useState, useEffect, useRef } from "react";
import { getAdminSubjects } from "../api/subjectsApi";
import {
    getAdminResources,
    requestAdminResourceUploadUrl,
    confirmAdminResourceUpload,
    updateAdminResource,
    deleteAdminResource,
    getResourceDownloadUrl,
} from "../api/resourcesApi";

const MAX_RESOURCE_UPLOAD_SIZE = 300 * 1024 * 1024;

const calculateSHA256 = async (file) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const UploadResources = () => {
    const {
        user,
        uploadedResources,
        downloadUrls,
        setUploadedResources,
        setDownloadUrls,
    } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [subjectName, setSubjectName] = useState([]);
    const [subjectYear, setSubjectYear] = useState([]);
    const [subjectCategory, setSubjectCategory] = useState([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [editingResource, setEditingResource] = useState(null);
    const [resourceEditForm, setResourceEditForm] = useState({
        title: '',
        subject: '',
        year: '',
        category: '',
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

    const getDownloadUrl = async (resourceId) => {
        try {
            const response = await getResourceDownloadUrl(resourceId);
            setDownloadUrls(prevState => ({
                ...prevState,
                [resourceId]: response.data.downloadUrl,
            }));
            return response.data.downloadUrl;
        } catch (error) {
            console.error('Error fetching download URL:', error);
            showNotification('error', error.response?.data?.message || 'Failed to fetch download URL');
            return null;
        }
    };

    const getPdfPreviewUrl = (pdfUrl) => {
        return pdfUrl || '';
    };

    const openPdfInNewTab = (pdfUrl) => {
        if (!pdfUrl) return;
        window.open(pdfUrl, '_blank', 'noopener,noreferrer');
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

            const urls = {};
            await Promise.all(resources.map(async (resource) => {
                const downloadUrl = await getDownloadUrl(resource._id);
                if (downloadUrl) {
                    urls[resource._id] = downloadUrl;
                }
            }));

            setDownloadUrls(urls);
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
            setDownloadUrls(prevState => {
                const newState = { ...prevState };
                delete newState[resourceId];
                return newState;
            });
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
            setResourceEditForm({ title: '', subject: '', year: '', category: '' });
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
        const form = e.currentTarget;
        setIsSubmitting(true);
        setUploadStatus('');
        try {
            const formData = new FormData(form);
            const file = formData.getAll('file');
            const metadata = {
                title: String(formData.get('title') || '').trim(),
                subject: String(formData.get('subject') || ''),
                year: String(formData.get('year') || ''),
                category: String(formData.get('category') || ''),
            };

            if (!metadata.title || !metadata.subject || !metadata.year || !metadata.category) {
                throw new Error('Please provide a title and select a subject, year, and category.');
            }
            if (!(file[0] instanceof File) || file[0].size === 0) {
                throw new Error('Please select a PDF file to upload.');
            }
            if (file[0].size > MAX_RESOURCE_UPLOAD_SIZE) {
                throw new Error('The PDF must be 300 MB or smaller.');
            }
            if (!/\.pdf$/i.test(file[0].name) || (file[0].type && file[0].type !== 'application/pdf')) {
                throw new Error('Only PDF files are supported.');
            }

            const header = new TextDecoder().decode(await file[0].slice(0, 1024).arrayBuffer());
            if (!header.includes('%PDF-')) {
                throw new Error('The selected file does not have a valid PDF header.');
            }

            setUploadStatus('Computing PDF SHA-256 checksum...');
            const hash = await calculateSHA256(file[0]);
            const uploadMetadata = {
                ...metadata,
                originalName: file[0].name,
                hash,
                size: file[0].size,
            };

            setUploadStatus('Checking for duplicates and requesting a secure upload URL...');
            const { data: uploadRequest } = await requestAdminResourceUploadUrl(uploadMetadata);

            setUploadStatus('Uploading PDF directly to secure storage...');
            let storageResponse;
            try {
                storageResponse = await fetch(uploadRequest.uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/pdf',
                    },
                    body: file[0],
                    credentials: 'omit',
                });
            } catch (storageError) {
                console.error('Browser could not reach B2 storage:', storageError);
                throw new Error(
                    `The browser could not reach B2 storage at ${new URL(uploadRequest.uploadUrl).host}. Check the bucket CORS rule for this page origin and S3 PUT.`
                );
            }
            if (!storageResponse.ok) {
                const responseText = await storageResponse.text();
                throw new Error(
                    `B2 rejected the upload (${storageResponse.status})${responseText ? `: ${responseText.slice(0, 300)}` : '.'}`
                );
            }

            setUploadStatus('Verifying the upload and saving resource details...');
            await confirmAdminResourceUpload(uploadMetadata);
            setUploadStatus('');
            form.reset();
            showNotification('success', 'Resource uploaded successfully!');
            await getResources();
        } catch (error) {
            console.error('Error uploading resource:', error);
            const message = error.response?.data?.message || error.message || 'Failed to upload resource';
            setUploadStatus('');
            showNotification('error', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const previewUrl = editingResource ? downloadUrls[editingResource._id] : '';
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
                                maxLength={200}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="subjectName" className={`block text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Subject Name
                            </label>
                            <select id="subject" name="subject" defaultValue="" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`} required>
                                <option value="" disabled>Select Subject</option>
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
                            <select id="year" name="year" defaultValue="" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`} required>
                                <option value="" disabled>Select Year</option>
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
                            <select id="category" name="category" defaultValue="" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`} required>
                                <option value="" disabled>Select Category</option>
                                {uniqueCategories.map((category, index) => (
                                    <option key={index} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="resourceFile" className={`mt-4 block text-sm font-medium md:mt-0 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                Upload Resource File
                            </label>
                            <input type="file" id="file" name="file" accept=".pdf,application/pdf" className={`mt-1 block w-full rounded-md p-2 shadow-sm ${inputClass}`} required />
                        </div>
                        <div className="mt-6 flex justify-center">
                            <button type="submit" disabled={isSubmitting} className="w-full cursor-pointer rounded-md bg-slate-800 px-6 py-2 text-white transition-colors duration-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 md:w-50">
                                {isSubmitting ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                        {uploadStatus && (
                            <p className={`text-sm md:col-span-3 ${mutedText}`} aria-live="polite">
                                {uploadStatus}
                            </p>
                        )}
                    </form>
                </div>
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
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y divide-gray-200 text-[15px] md:text-sm ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-gray-700'}`}>
                                    {uploadedResources.map((resource) => {
                                        const pdfUrl = downloadUrls[resource._id];
                                        const previewUrl = getPdfPreviewUrl(pdfUrl);

                                        return (
                                            <tr key={resource._id} className="align-top">
                                                <td className="px-2 py-2 md:px-6 md:py-4">
                                                    <div className="group relative min-w-0">
                                                        {pdfUrl ? (
                                                            <a
                                                                href={pdfUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block break-all text-blue-600 hover:text-blue-800 hover:underline"
                                                            >
                                                                {resource.title}
                                                            </a>
                                                        ) : (
                                                            <span className="block break-all">{resource.title}</span>
                                                        )}

                                                        {previewUrl && (
                                                            <div className={`invisible absolute left-0 top-1/2 z-60 w-[min(88vw,420px)] -translate-y-1/2 rounded-xl border p-2 opacity-0 shadow-2xl transition-all duration-500 group-hover:visible group-hover:opacity-100 md:left-full md:ml-4 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                                                                <div className={`overflow-hidden rounded-lg border ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                                                                    <iframe
                                                                        src={previewUrl}
                                                                        title={`${resource.title} preview`}
                                                                        className="h-155 w-full cursor-pointer border-0"
                                                                        loading="lazy"
                                                                        onClick={() => openPdfInNewTab(pdfUrl)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 break-all md:px-6 md:py-4">
                                                    {resource.subject}
                                                </td>
                                                <td className="px-2 py-2 break-all md:px-6 md:py-4">
                                                    {resource.year}
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

                            <div className={`mb-5 overflow-hidden rounded-xl border p-3 ${modalPanel}`}>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Document Preview</span>
                                    {previewUrl && (
                                        <button
                                            type="button"
                                            onClick={() => openPdfInNewTab(previewUrl)}
                                            className="text-xs font-medium text-blue-600 hover:text-blue-800"
                                        >
                                            Open in new tab
                                        </button>
                                    )}
                                </div>
                                {previewUrl ? (
                                    <iframe
                                        src={previewUrl}
                                        title={`${editingResource.title} preview`}
                                        className="h-65ll rounded-lg border-0 sm:h-105"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className={`flex h-45 items-center justify-center rounded-lg border border-dashed text-sm ${isDark ? 'border-slate-600 bg-slate-900 text-slate-300' : 'border-gray-300 bg-white text-gray-500'}`}>
                                        No preview available for this document.
                                    </div>
                                )}
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