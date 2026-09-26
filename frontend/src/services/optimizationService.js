import api from './api';

export const optimizationService = {
  // Execute comparative optimization for a simulation or scenario
  runOptimization: async (params) => {
    const response = await api.post('/optimization/run', params);
    return response.data;
  },

  // Retrieve specific optimization result by ID
  getOptimization: async (optId) => {
    const response = await api.get(`/optimization/${optId}`);
    return response.data;
  },

  // Retrieve past optimization execution history
  getHistory: async (limit = 20) => {
    const response = await api.get('/optimization/history', { params: { limit } });
    return response.data;
  },

  // Retrieve active objective function weights
  getConfig: async () => {
    const response = await api.get('/optimization/config');
    return response.data;
  },

  // Update objective function weights and optimization parameters
  updateConfig: async (configData) => {
    const response = await api.put('/optimization/config', configData);
    return response.data;
  }
};
