import api from './api';

export const analyticsService = {
  // Retrieve top-level overview KPIs
  getOverview: async () => {
    const response = await api.get('/analytics/overview');
    return response.data;
  },

  // Retrieve traceable research summary
  getResearchSummary: async () => {
    const response = await api.get('/analytics/research-summary');
    return response.data;
  },

  // Retrieve crowd density time series, location comparisons, and peak analysis
  getCrowdAnalytics: async (params = {}) => {
    const response = await api.get('/analytics/crowd', { params });
    return response.data;
  },

  // Retrieve ML validation metrics, actual vs predicted samples, and location errors
  getPredictionAnalytics: async (params = {}) => {
    const response = await api.get('/analytics/predictions', { params });
    return response.data;
  },

  // Retrieve routing mode comparisons and corridor utilization
  getRoutingAnalytics: async (params = {}) => {
    const response = await api.get('/analytics/routing', { params });
    return response.data;
  },

  // Retrieve emergency evacuation simulation analytics
  getEmergencyAnalytics: async (params = {}) => {
    const response = await api.get('/analytics/emergency', { params });
    return response.data;
  },

  // Retrieve optimization metrics (baseline vs optimized)
  getOptimizationAnalytics: async (params = {}) => {
    const response = await api.get('/analytics/optimization', { params });
    return response.data;
  },

  // Retrieve What-If scenario analytics
  getWhatIfAnalytics: async (params = {}) => {
    const response = await api.get('/analytics/what-if', { params });
    return response.data;
  },

  // Retrieve bottleneck corridor analytics
  getBottleneckAnalytics: async () => {
    const response = await api.get('/analytics/bottlenecks');
    return response.data;
  },

  // Retrieve perimeter exit capacity and load analytics
  getExitAnalytics: async () => {
    const response = await api.get('/analytics/exits');
    return response.data;
  },

  // Retrieve system performance execution latencies
  getPerformanceAnalytics: async () => {
    const response = await api.get('/analytics/performance');
    return response.data;
  },

  // Retrieve data quality and integrity audit
  getDataQualityAnalytics: async () => {
    const response = await api.get('/analytics/data-quality');
    return response.data;
  },

  // Download complete research analytics CSV report
  exportCsvReport: async () => {
    const response = await api.get('/analytics/export', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'campus_research_analytics_report.csv');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
  }
};
