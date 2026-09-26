import api from './api';

export const crowdService = {
  // Query Records
  async getCrowdRecords(params = {}) {
    const response = await api.get('/crowd', { params });
    return response.data;
  },

  async getCrowdRecord(id) {
    const response = await api.get(`/crowd/${id}`);
    return response.data;
  },

  async createCrowdRecord(data) {
    const response = await api.post('/crowd', data);
    return response.data;
  },

  async updateCrowdRecord(id, data) {
    const response = await api.put(`/crowd/${id}`, data);
    return response.data;
  },

  async deleteCrowdRecord(id) {
    const response = await api.delete(`/crowd/${id}`);
    return response.data;
  },

  // Live and Summary State
  async getCurrentCrowd() {
    const response = await api.get('/crowd/current');
    return response.data;
  },

  async getCrowdSummary() {
    const response = await api.get('/crowd/summary');
    return response.data;
  },

  async getCrowdTrends(params = {}) {
    const response = await api.get('/crowd/trends', { params });
    return response.data;
  },

  // Simulation Controls
  async runSimulationStep(scenario = 'random') {
    const response = await api.post('/crowd/simulation/step', { scenario });
    return response.data;
  },

  async resetSimulation() {
    const response = await api.post('/crowd/simulation/reset');
    return response.data;
  },

  // System Alerts
  async getAlerts(params = {}) {
    const response = await api.get('/crowd/alerts', { params });
    return response.data;
  },

  async dismissAlert(id) {
    const response = await api.post(`/crowd/alerts/${id}/dismiss`);
    return response.data;
  }
};
