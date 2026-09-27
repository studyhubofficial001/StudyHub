import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SidebarNav from '../components/SidebarNav';
import { Menu } from 'lucide-react';
import api from '../api/axiosInstance';

const AdminSubjects = () => {
    const [subject, setSubject] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [year, setYear] = useState('');
    const [category, setCategory] = useState('');
    const nav = useNavigate();
    const [getSubjects, setGetSubjects] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const response = await api.get('/admin/subjects');
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
            await api.delete(`/admin/subjects/${id}`);
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
            const response = await api.post('/admin/subjects', {
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

    return (
        <>
            <div className="md:p-10 bg-[rgb(244,247,239)] p-4 grid grid-cols-100 h-screen relative">
                <div className="hidden sm:block md:col-span-14 md:mb-0 mb-4">
                    <SidebarNav />
                </div>
                <div className="sm:hidden pt-1 flex flex-col mb-4">
                    <Menu
                        className="cursor-pointer text-gray-800"
                        onClick={() => setIsSidebarOpen(true)}
                    />
                </div>
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    ></div>
                )}
                <div className={`fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-lg transform transition-transform duration-300 ease-in-out sm:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="flex justify-end p-4">
                        <button onClick={() => setIsSidebarOpen(false)} className="text-3xl font-bold cursor-pointer text-gray-600">&times;</button>
                    </div>
                    <div className="px-4">
                        <SidebarNav />
                    </div>
                </div>
                <div className="w-full ml-6 md:ml-10 md:col-span-86 col-span-96">
                    <h1 className="text-3xl md:text-4xl text-gray-900 italic font-bold md:pb-1 pb-2">Admin Panel</h1>
                    <p className="md:text-lg md:mb-3 text-sm text-gray-600">Subjects you add or remove here control what every student sees on their dashboard.</p>
                    <div className="flex flex-col md:w-45/50 w-48/50 mt-4 bg-white p-4 rounded-lg">
                        <form onSubmit={handleSubmit} className="md:grid grid-cols-4 items-center gap-4 md:w-58/60">
                            <div className="flex flex-col">
                                <label htmlFor="subject" className="text-gray-700 md:mb-2 mb-1">Subject Name</label>
                                <input type="text" id="subject" name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Enter subject name" className="border p-2 rounded-lg" required />
                            </div>
                            <div className="md:ml-4 md:mt-0 mt-4 flex flex-col">
                                <label htmlFor="year" className="text-gray-700 md:mb-2 mb-1">Year</label>
                                <select id="year" name="year" value={year} onChange={(e) => setYear(e.target.value)} className="border p-2 rounded-lg" required>
                                    <option value="">Select Year</option>
                                    <option value="1">Year 1</option>
                                    <option value="2">Year 2</option>
                                    <option value="3">Year 3</option>
                                    <option value="4">Final Year</option>
                                </select>
                            </div>
                            <div className="md:ml-4 md:mt-0 mt-4 flex flex-col">
                                <label htmlFor="category" className="text-gray-700 md:mb-2 mb-1">Category</label>
                                <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="border p-2 rounded-lg" required>
                                    <option value="">Select Category</option>
                                    <option value="core">Core</option>
                                    <option value="optional">optional</option>
                                </select>
                            </div>
                            <div className="md:ml-4 mt-8 flex flex-col md:p-3">
                                <button type="submit" className="bg-gray-800 cursor-pointer text-white p-3 rounded-md md:my-4 hover:bg-gray-900">Add Subject</button>
                            </div>
                        </form>
                    </div>
                    <div>
                        {errorMessage && <p className="text-red-500 col-span-4">{errorMessage}</p>}
                        {successMessage && <p className="text-green-500 col-span-4">{successMessage}</p>}
                    </div>
                    <div className="md:text-md text-sm">
                        <table>
                            <thead>
                                <tr className="text-gray-900 grid grid-cols-4 md:gap-40 border-b border-gray-500 md:mt-6 pb-2 mt-4">
                                    <th className="text-left">Subject</th>
                                    <th className="text-left">Year</th>
                                    <th className="text-left">Category</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getSubjects.map((item) => (
                                    <tr key={item._id} className="text-gray-700 grid grid-cols-4 md:gap-40 border-b pb-2 border-gray-500 mt-4">
                                        <td className="text-left">{item.name}</td>
                                        <td className="text-left">{item.year}</td>
                                        <td className="text-left">{item.category}</td>
                                        <td className="text-left flex flex-row items-start md:gap-6 gap-3">
                                            <button onClick={() => handleDelete(item._id)} className="cursor-pointer">Remove</button>
                                            <button onClick={() => nav('/edit-subject')} className="cursor-pointer">Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AdminSubjects;
