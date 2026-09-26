import api from './api';

export const routeService = {
  // Calculate optimal recommended and alternative routes
  calculateRoute: async ({
    start_node_id,
    destination_node_id,
    mode = 'CROWD_AWARE',
    horizon_hours = 1,
    prediction_time = null
  }) => {
    const response = await api.post('/routes/calculate', {
      start_node_id: Number(start_node_id),
      destination_node_id: Number(destination_node_id),
      mode,
      horizon_hours: Number(horizon_hours),
      prediction_time
    });
    return response.data;
  },

  // Retrieve routing configuration and weights
  getRoutingConfig: async () => {
    const response = await api.get('/routes/config');
    return response.data;
  },

  // Update routing configuration (Admin only)
  updateRoutingConfig: async (configData) => {
    const response = await api.put('/routes/config', configData);
    return response.data;
  }
};
