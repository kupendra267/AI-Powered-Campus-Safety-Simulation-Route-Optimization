import api from './api';

export const predictionService = {
  // Predict future crowd for a location at a target time
  predictCrowd: async (locationId, predictionTime = null) => {
    const response = await api.post('/predictions/predict', {
      location_id: locationId,
      prediction_time: predictionTime
    });
    return response.data;
  },

  // Get multi-step rolling timeline predictions for a location (+1h, +2h, +3h, +4h, etc.)
  getLocationForecast: async (locationId, horizons = [1, 2, 3, 4, 6]) => {
    const horizonsStr = horizons.join(',');
    const response = await api.get(`/predictions/location/${locationId}?horizons=${horizonsStr}`);
    return response.data;
  },

  // Get campus-wide prediction summary across all facilities
  getPredictionSummary: async (horizon = 1) => {
    const response = await api.get(`/predictions/summary?horizon=${horizon}`);
    return response.data;
  },

  // Get ML model architecture, genuine evaluation metrics (MAE, RMSE, R2), and test samples
  getModelInfo: async () => {
    const response = await api.get('/predictions/model-info');
    return response.data;
  },

  // Get logged historical predictions
  getPredictionLogs: async (locationId = null, limit = 50) => {
    const url = locationId 
      ? `/predictions?location_id=${locationId}&limit=${limit}`
      : `/predictions?limit=${limit}`;
    const response = await api.get(url);
    return response.data;
  },

  // Admin trigger to retrain the ML model on demand
  trainModel: async (days = 90) => {
    const response = await api.post('/predictions/train', { days });
    return response.data;
  }
};
