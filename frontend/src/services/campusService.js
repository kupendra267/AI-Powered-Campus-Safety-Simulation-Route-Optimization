import api from './api';

export const campusService = {
  // Graph Topology
  async getCampusGraph() {
    const response = await api.get('/campus/graph');
    return response.data;
  },

  // Buildings
  async getBuildings() {
    const response = await api.get('/campus/buildings');
    return response.data;
  },
  async getAllBuildings() {
    const response = await api.get('/campus/buildings');
    return response.data;
  },
  async getBuilding(id) {
    const response = await api.get(`/campus/buildings/${id}`);
    return response.data;
  },
  async createBuilding(data) {
    const response = await api.post('/campus/buildings', data);
    return response.data;
  },
  async updateBuilding(id, data) {
    const response = await api.put(`/campus/buildings/${id}`, data);
    return response.data;
  },
  async deleteBuilding(id) {
    const response = await api.delete(`/campus/buildings/${id}`);
    return response.data;
  },

  // Nodes
  async getNodes() {
    const response = await api.get('/campus/nodes');
    return response.data;
  },
  async getNode(id) {
    const response = await api.get(`/campus/nodes/${id}`);
    return response.data;
  },
  async createNode(data) {
    const response = await api.post('/campus/nodes', data);
    return response.data;
  },
  async updateNode(id, data) {
    const response = await api.put(`/campus/nodes/${id}`, data);
    return response.data;
  },
  async deleteNode(id) {
    const response = await api.delete(`/campus/nodes/${id}`);
    return response.data;
  },

  // Paths
  async getPaths() {
    const response = await api.get('/campus/paths');
    return response.data;
  },
  async getPath(id) {
    const response = await api.get(`/campus/paths/${id}`);
    return response.data;
  },
  async createPath(data) {
    const response = await api.post('/campus/paths', data);
    return response.data;
  },
  async updatePath(id, data) {
    const response = await api.put(`/campus/paths/${id}`, data);
    return response.data;
  },
  async togglePathStatus(id) {
    const response = await api.post(`/campus/paths/${id}/toggle-status`);
    return response.data;
  },
  async deletePath(id) {
    const response = await api.delete(`/campus/paths/${id}`);
    return response.data;
  },

  // Exits
  async getExits() {
    const response = await api.get('/campus/exits');
    return response.data;
  },
  async getExit(id) {
    const response = await api.get(`/campus/exits/${id}`);
    return response.data;
  },
  async createExit(data) {
    const response = await api.post('/campus/exits', data);
    return response.data;
  },
  async updateExit(id, data) {
    const response = await api.put(`/campus/exits/${id}`, data);
    return response.data;
  },
  async deleteExit(id) {
    const response = await api.delete(`/campus/exits/${id}`);
    return response.data;
  }
};
