import api from './api';

export const emergencyService = {
  // Scenarios CRUD & Lifecycle
  getScenarios: async (status = null) => {
    const params = status ? { status } : {};
    const response = await api.get('/emergency', { params });
    return response.data;
  },

  getScenario: async (scenarioId) => {
    const response = await api.get(`/emergency/${scenarioId}`);
    return response.data;
  },

  createScenario: async (scenarioData) => {
    const response = await api.post('/emergency', scenarioData);
    return response.data;
  },

  updateScenario: async (scenarioId, scenarioData) => {
    const response = await api.put(`/emergency/${scenarioId}`, scenarioData);
    return response.data;
  },

  deleteScenario: async (scenarioId) => {
    const response = await api.delete(`/emergency/${scenarioId}`);
    return response.data;
  },

  startEmergency: async (scenarioId) => {
    const response = await api.post(`/emergency/${scenarioId}/start`);
    return response.data;
  },

  stopEmergency: async (scenarioId) => {
    const response = await api.post(`/emergency/${scenarioId}/stop`);
    return response.data;
  },

  getActiveEmergency: async () => {
    const response = await api.get('/emergency/active');
    return response.data;
  },

  // Evacuation Simulations
  runSimulation: async (simulationParams) => {
    const response = await api.post('/simulation/run', simulationParams);
    return response.data;
  },

  getSimulation: async (simulationId) => {
    const response = await api.get(`/simulation/${simulationId}`);
    return response.data;
  },

  getSimulationResults: async (simulationId) => {
    const response = await api.get(`/simulation/${simulationId}/results`);
    return response.data;
  },

  getSimulationHistory: async (limit = 20) => {
    const response = await api.get('/simulation/history', { params: { limit } });
    return response.data;
  },

  whatIfBlockExit: async (scenarioId, exitId) => {
    const response = await api.post('/simulation/what-if/block-exit', {
      scenario_id: Number(scenarioId),
      exit_id: Number(exitId)
    });
    return response.data;
  }
};
