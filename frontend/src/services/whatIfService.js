import api from './api';

export const whatIfService = {
  // Retrieve list of What-If scenarios with optional filters
  getScenarios: async (params = {}) => {
    const response = await api.get('/what-if', { params });
    return response.data;
  },

  // Retrieve single What-If scenario details
  getScenarioById: async (id) => {
    const response = await api.get(`/what-if/${id}`);
    return response.data;
  },

  // Create a new What-If scenario specification
  createScenario: async (data) => {
    const response = await api.post('/what-if', data);
    return response.data;
  },

  // Update existing What-If scenario
  updateScenario: async (id, data) => {
    const response = await api.put(`/what-if/${id}`, data);
    return response.data;
  },

  // Delete What-If scenario
  deleteScenario: async (id) => {
    const response = await api.delete(`/what-if/${id}`);
    return response.data;
  },

  // Execute What-If simulation and optimization on a saved scenario
  runScenario: async (id, data = {}) => {
    const response = await api.post(`/what-if/${id}/run`, data);
    return response.data;
  },

  // Retrieve full results for a scenario
  getScenarioResults: async (id) => {
    const response = await api.get(`/what-if/${id}/results`);
    return response.data;
  },

  // Execute What-If analysis immediately
  quickRun: async (data) => {
    const response = await api.post('/what-if/quick-run', data);
    return response.data;
  },

  // Compare multiple scenarios side-by-side against baseline
  compareScenarios: async (scenarioIds) => {
    const response = await api.post('/what-if/compare', { scenario_ids: scenarioIds });
    return response.data;
  }
};
