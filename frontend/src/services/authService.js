import api from './api';

export const authService = {
  async register(name, email, password, role = 'STUDENT') {
    const response = await api.post('/auth/register', { name, email, password, role });
    return response.data;
  },

  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
  },

  async getProfile() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async checkAdminAccess() {
    const response = await api.get('/auth/admin-check');
    return response.data;
  },

  async checkStudentAccess() {
    const response = await api.get('/auth/student-check');
    return response.data;
  }
};
