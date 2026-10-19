import api from './axiosInstance';

export const getAdminSyllabi = () => api.get('/admin/syllabus');
export const getCurrentSyllabus = () => api.get('/syllabus');
export const getCurrentSyllabusDownloadUrl = () => api.get('/syllabus/download');
export const createAdminSyllabus = (formData) => api.post('/admin/syllabus', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
export const updateAdminSyllabus = (id, formData) => api.put(`/admin/syllabus/${id}`, formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
export const deleteAdminSyllabus = (id) => api.delete(`/admin/syllabus/${id}`);
export const getSyllabusDownloadUrl = (syllabusId) => api.get(`/admin/syllabus/${syllabusId}/download`);
