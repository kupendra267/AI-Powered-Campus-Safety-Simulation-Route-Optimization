import React, { useState, useEffect } from 'react';
import { campusService } from '../../services/campusService';
import { 
  Building2, 
  MapPin, 
  Navigation, 
  DoorOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  Ban, 
  AlertCircle,
  RefreshCw,
  Layers,
  X,
  ArrowRight
} from 'lucide-react';

const CampusManagement = () => {
  const [activeTab, setActiveTab] = useState('buildings'); // 'buildings' | 'nodes' | 'paths' | 'exits'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Data lists
  const [buildings, setBuildings] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [paths, setPaths] = useState([]);
  const [exits, setExits] = useState([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [modalEntity, setModalEntity] = useState('buildings'); // 'buildings' | 'nodes' | 'paths' | 'exits'
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, nRes, pRes, eRes] = await Promise.all([
        campusService.getBuildings(),
        campusService.getNodes(),
        campusService.getPaths(),
        campusService.getExits()
      ]);
      if (bRes.success) setBuildings(bRes.data);
      if (nRes.success) setNodes(nRes.data);
      if (pRes.success) setPaths(pRes.data);
      if (eRes.success) setExits(eRes.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch campus data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Open Create Modal
  const handleOpenCreate = (entity) => {
    setModalEntity(entity);
    setModalMode('create');
    setFormData({});
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (entity, item) => {
    setModalEntity(entity);
    setModalMode('edit');
    setFormData({ ...item });
    setModalOpen(true);
  };

  // Submit Modal Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (modalEntity === 'buildings') {
        if (modalMode === 'create') {
          const res = await campusService.createBuilding(formData);
          showNotification(res.message);
        } else {
          const res = await campusService.updateBuilding(formData.id, formData);
          showNotification(res.message);
        }
      } else if (modalEntity === 'nodes') {
        if (modalMode === 'create') {
          const res = await campusService.createNode(formData);
          showNotification(res.message);
        } else {
          const res = await campusService.updateNode(formData.id, formData);
          showNotification(res.message);
        }
      } else if (modalEntity === 'paths') {
        if (modalMode === 'create') {
          const res = await campusService.createPath(formData);
          showNotification(res.message);
        } else {
          const res = await campusService.updatePath(formData.id, formData);
          showNotification(res.message);
        }
      } else if (modalEntity === 'exits') {
        if (modalMode === 'create') {
          const res = await campusService.createExit(formData);
          showNotification(res.message);
        } else {
          const res = await campusService.updateExit(formData.id, formData);
          showNotification(res.message);
        }
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Entity
  const handleDelete = async (entity, id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${entity.slice(0, -1)}: "${name || id}"?`)) return;

    try {
      if (entity === 'buildings') await campusService.deleteBuilding(id);
      if (entity === 'nodes') await campusService.deleteNode(id);
      if (entity === 'paths') await campusService.deletePath(id);
      if (entity === 'exits') await campusService.deleteExit(id);
      showNotification(`Deleted successfully.`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete entity.');
    }
  };

  // Toggle Path Status
  const handleTogglePath = async (id) => {
    try {
      const res = await campusService.togglePathStatus(id);
      showNotification(res.message);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle path status.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-amber-400" />
            Campus Topology Management
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Administrative CRUD management for campus buildings, graph junctions, corridors, and exits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => handleOpenCreate(activeTab)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add {activeTab.slice(0, -1).toUpperCase()}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Entity Tabs */}
      <div className="flex border-b border-slate-700/80 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('buildings')}
          className={`px-4 py-2.5 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'buildings'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Buildings ({buildings.length})
        </button>
        <button
          onClick={() => setActiveTab('nodes')}
          className={`px-4 py-2.5 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'nodes'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Junction Nodes ({nodes.length})
        </button>
        <button
          onClick={() => setActiveTab('paths')}
          className={`px-4 py-2.5 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'paths'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Navigation className="w-4 h-4" />
          Corridor Paths ({paths.length})
        </button>
        <button
          onClick={() => setActiveTab('exits')}
          className={`px-4 py-2.5 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'exits'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <DoorOpen className="w-4 h-4" />
          Exits ({exits.length})
        </button>
      </div>

      {/* TAB 1: BUILDINGS TABLE */}
      {activeTab === 'buildings' && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Building Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Connected Node</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {buildings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">{b.building_code}</td>
                    <td className="px-4 py-3 font-medium text-white">{b.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-semibold">
                        {b.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">Node #{b.node_id} ({b.node_name})</td>
                    <td className="px-4 py-3 font-bold text-slate-200">{b.capacity} people</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit('buildings', b)}
                        className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                        title="Edit Building"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('buildings', b.id, b.name)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Delete Building"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NODES TABLE */}
      {activeTab === 'nodes' && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Node Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Coordinates (Lat, Lon)</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {nodes.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">#{n.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{n.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-[10px] font-semibold">
                        {n.node_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {n.latitude.toFixed(5)}, {n.longitude.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit('nodes', n)}
                        className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                        title="Edit Node"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('nodes', n.id, n.name)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Delete Node"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PATHS TABLE */}
      {activeTab === 'paths' && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Source Node</th>
                  <th className="px-4 py-3">Destination Node</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {paths.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">#{p.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{p.source_node_name} (#{p.source_node_id})</td>
                    <td className="px-4 py-3 font-medium text-white">{p.destination_node_name} (#{p.destination_node_id})</td>
                    <td className="px-4 py-3 font-mono">{p.distance_meters} m</td>
                    <td className="px-4 py-3">{p.capacity} /min</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.status === 'BLOCKED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleTogglePath(p.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                          p.status === 'BLOCKED'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30'
                        }`}
                        title="Toggle Status"
                      >
                        {p.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        onClick={() => handleOpenEdit('paths', p)}
                        className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                        title="Edit Path"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('paths', p.id, `Path #${p.id}`)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Delete Path"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EXITS TABLE */}
      {activeTab === 'exits' && (
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Exit Name</th>
                  <th className="px-4 py-3">Connected Node</th>
                  <th className="px-4 py-3">Evacuation Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {exits.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-blue-400">#{e.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{e.name}</td>
                    <td className="px-4 py-3 text-slate-400">Node #{e.node_id} ({e.node_name})</td>
                    <td className="px-4 py-3 font-bold text-slate-200">{e.capacity} people/min</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        e.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit('exits', e)}
                        className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                        title="Edit Exit"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('exits', e.id, e.name)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Delete Exit"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRUD MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">
                {modalMode === 'create' ? 'Create New' : 'Edit'} {modalEntity.slice(0, -1).toUpperCase()}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* BUILDINGS FORM */}
              {modalEntity === 'buildings' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Building Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      placeholder="e.g. Turing Computer Science Center"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Code</label>
                      <input
                        type="text"
                        required
                        value={formData.building_code || ''}
                        onChange={(e) => setFormData({ ...formData, building_code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                        placeholder="CS-01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Type</label>
                      <select
                        value={formData.type || 'ACADEMIC'}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="ACADEMIC">ACADEMIC</option>
                        <option value="LIBRARY">LIBRARY</option>
                        <option value="CANTEEN">CANTEEN</option>
                        <option value="HOSTEL">HOSTEL</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="AUDITORIUM">AUDITORIUM</option>
                        <option value="LAB">LAB</option>
                        <option value="MEDICAL">MEDICAL</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Associated Node</label>
                      <select
                        required
                        value={formData.node_id || ''}
                        onChange={(e) => setFormData({ ...formData, node_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="">Select Node</option>
                        {nodes.map(n => (
                          <option key={n.id} value={n.id}>#{n.id}: {n.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Capacity</label>
                      <input
                        type="number"
                        required
                        value={formData.capacity || 500}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    />
                  </div>
                </>
              )}

              {/* NODES FORM */}
              {modalEntity === 'nodes' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Node Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      placeholder="e.g. Central Library Junction"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.00001"
                        required
                        value={formData.latitude || ''}
                        onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                        placeholder="12.9716"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.00001"
                        required
                        value={formData.longitude || ''}
                        onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                        placeholder="77.5946"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Node Type</label>
                    <select
                      value={formData.node_type || 'JUNCTION'}
                      onChange={(e) => setFormData({ ...formData, node_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value="JUNCTION">JUNCTION</option>
                      <option value="BUILDING">BUILDING</option>
                      <option value="GATEWAY">GATEWAY</option>
                      <option value="EXIT">EXIT</option>
                    </select>
                  </div>
                </>
              )}

              {/* PATHS FORM */}
              {modalEntity === 'paths' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Source Node</label>
                      <select
                        required
                        value={formData.source_node_id || ''}
                        onChange={(e) => setFormData({ ...formData, source_node_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="">Select Source</option>
                        {nodes.map(n => (
                          <option key={n.id} value={n.id}>#{n.id}: {n.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Destination Node</label>
                      <select
                        required
                        value={formData.destination_node_id || ''}
                        onChange={(e) => setFormData({ ...formData, destination_node_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="">Select Destination</option>
                        {nodes.map(n => (
                          <option key={n.id} value={n.id}>#{n.id}: {n.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Distance (meters, 0 for auto)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.distance_meters || ''}
                        onChange={(e) => setFormData({ ...formData, distance_meters: e.target.value })}
                        placeholder="Leave 0 for haversine auto"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Capacity (throughput/min)</label>
                      <input
                        type="number"
                        value={formData.capacity || 150}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                    <select
                      value={formData.status || 'OPEN'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value="OPEN">OPEN (Accessible)</option>
                      <option value="BLOCKED">BLOCKED (Closed)</option>
                      <option value="CONGESTED">CONGESTED (High Traffic)</option>
                    </select>
                  </div>
                </>
              )}

              {/* EXITS FORM */}
              {modalEntity === 'exits' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Exit Gate Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      placeholder="e.g. Gate 1 - North Highway Terminal"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Connected Node</label>
                      <select
                        required
                        value={formData.node_id || ''}
                        onChange={(e) => setFormData({ ...formData, node_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      >
                        <option value="">Select Node</option>
                        {nodes.map(n => (
                          <option key={n.id} value={n.id}>#{n.id}: {n.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Evacuation Throughput/Min</label>
                      <input
                        type="number"
                        required
                        value={formData.capacity || 500}
                        onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                    <select
                      value={formData.status || 'ACTIVE'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="BLOCKED">BLOCKED</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                >
                  {submitting ? 'Saving...' : modalMode === 'create' ? 'Create Entity' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusManagement;
