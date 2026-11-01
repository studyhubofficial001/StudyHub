import api from './axiosInstance';

export const getAdminResources = () => api.get('/admin/resources');
export const createAdminResource = (formData) => api.post('/admin/resources', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
export const updateAdminResource = (id, payload) => api.put(`/admin/resources/${id}`, payload);
export const deleteAdminResource = (id) => api.delete(`/admin/resources/${id}`);
export const getResourceDownloadUrl = (resourceId) => api.get(`/admin/resources/${resourceId}/download`);
export const getUserResources = () => api.get('/resources');
export const getUserResourceDownloadUrl = (resourceId) => api.get(`/resources/${resourceId}/download`);
export const getUserPyqCodeResources = () => api.get('/resources/pyq-code');
export const getUserPyqCodeResourceDownloadUrl = (resourceId) => api.get(`/resources/pyq-code/${resourceId}/download`);
export const getIngestionStatus = () => api.get('/admin/ingestion');
export const retryIngestion = (id) => api.post(`/admin/ingestion/${id}/retry`);