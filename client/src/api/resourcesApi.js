import api from './axiosInstance';

export const getAdminResources = () => api.get('/admin/resources');
export const requestAdminResourceUploadUrl = (payload) => api.post('/admin/resources/upload-url', payload);
export const confirmAdminResourceUpload = (payload) => api.post('/admin/resources/confirm', payload);
export const updateAdminResource = (id, payload) => api.put(`/admin/resources/${id}`, payload);
export const deleteAdminResource = (id) => api.delete(`/admin/resources/${id}`);
export const getResourceDownloadUrl = (resourceId) => api.get(`/admin/resources/${resourceId}/download`);
export const getUserResources = () => api.get('/resources');
export const getUserResourceDownloadUrl = (resourceId) => api.get(`/resources/${resourceId}/download`);
