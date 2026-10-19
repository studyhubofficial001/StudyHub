import api from './axiosInstance';

export const getUserSubjects = () => api.get('/users/subjects');
export const getAdminSubjects = () => api.get('/admin/subjects');
export const addAdminSubject = (payload) => api.post('/admin/subjects', payload);
export const updateAdminSubject = (id, payload) => api.put(`/admin/subjects/${id}`, payload);
export const deleteAdminSubject = (id) => api.delete(`/admin/subjects/${id}`);
export const sendFeatureAnnouncement = (payload) => api.post('/admin/feature-announcement', payload);
export const advanceStudentsToNextYear = () => api.post('/admin/year-rollover');
export const rollbackStudentsYearAdvance = () => api.post('/admin/year-rollover/rollback');
