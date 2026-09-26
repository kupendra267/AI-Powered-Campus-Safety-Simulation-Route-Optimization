import React, { useState, useEffect } from 'react';
import { crowdService } from '../../services/crowdService';
import { campusService } from '../../services/campusService';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Filter, 
  X,
  Flame,
  Activity,
  Calendar
} from 'lucide-react';

const CrowdManagement = () => {
  const [records, setRecords] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCongestion, setSelectedCongestion] = useState('ALL');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [formData, setFormData] = useState({
    location_id: '',
    crowd_count: 0,
    capacity: 500,
    source: 'MANUAL_ENTRY'
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, bRes] = await Promise.all([
        crowdService.getCrowdRecords({
          page,
          limit: pagination.limit,
          location_id: selectedLocation || undefined,
          congestion_level: selectedCongestion !== 'ALL' ? selectedCongestion : undefined
        }),
        campusService.getBuildings()
      ]);

      if (recRes.success) {
        setRecords(recRes.data);
        if (recRes.pagination) setPagination(recRes.pagination);
      }
      if (bRes.success) setBuildings(bRes.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch crowd records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(1);
  }, [selectedLocation, selectedCongestion]);

  const showNotification = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    const defaultBuilding = buildings[0];
    setFormData({
      location_id: defaultBuilding?.id || '',
      crowd_count: 50,
      capacity: defaultBuilding?.capacity || 500,
      source: 'MANUAL_ENTRY'
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (rec) => {
    setModalMode('edit');
    setFormData({
      id: rec.id,
      location_id: rec.location_id,
      crowd_count: rec.crowd_count,
      capacity: rec.capacity,
      source: rec.source
    });
    setModalOpen(true);
  };

  const handleLocationChange = (locId) => {
    const b = buildings.find(item => item.id === parseInt(locId));
    setFormData({
      ...formData,
      location_id: locId,
      capacity: b ? b.capacity : formData.capacity
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (modalMode === 'create') {
        const res = await crowdService.createCrowdRecord(formData);
        showNotification(res.message);
      } else {
        const res = await crowdService.updateCrowdRecord(formData.id, formData);
        showNotification(res.message);
      }
      setModalOpen(false);
      fetchRecords(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save crowd record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete crowd record #${id}?`)) return;

    try {
      await crowdService.deleteCrowdRecord(id);
      showNotification('Record deleted successfully.');
      fetchRecords(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete record.');
    }
  };

  // Live Density preview in modal
  const computedDensity = formData.capacity > 0 ? Math.round((formData.crowd_count / formData.capacity) * 100) : 0;
  let computedCongestion = 'LOW';
  if (computedDensity > 90) computedCongestion = 'CRITICAL';
  else if (computedDensity > 70) computedCongestion = 'HIGH';
  else if (computedDensity > 40) computedCongestion = 'MEDIUM';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-400" />
            Crowd Data Management
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Log raw sensor readings, inspect historical crowd datasets, and manage density records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRecords(pagination.page)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Crowd Record
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

      {/* Filter Bar */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 font-medium">Facility:</span>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
            >
              <option value="">All Locations</option>
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.building_code})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Congestion:</span>
            <select
              value={selectedCongestion}
              onChange={(e) => setSelectedCongestion(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
            >
              <option value="ALL">All Levels</option>
              <option value="LOW">LOW (0-40%)</option>
              <option value="MEDIUM">MEDIUM (41-70%)</option>
              <option value="HIGH">HIGH (71-90%)</option>
              <option value="CRITICAL">CRITICAL (91-100%+)</option>
            </select>
          </div>
        </div>

        <span className="text-slate-400 text-[11px]">
          Showing {records.length} of {pagination.total} records
        </span>
      </div>

      {/* Records Table */}
      <div className="bg-slate-800/70 border border-slate-700 rounded-2xl overflow-hidden backdrop-blur shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Facility Location</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Crowd / Capacity</th>
                <th className="px-4 py-3">Density (%)</th>
                <th className="px-4 py-3">Congestion</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-blue-400">#{r.id}</td>
                  <td className="px-4 py-3 font-medium text-white">
                    {r.location_name}
                    <span className="text-[10px] font-mono text-slate-400 ml-1.5">({r.building_code})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-[11px]">
                    {r.timestamp ? new Date(r.timestamp).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-200">
                    {r.crowd_count} / {r.capacity}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    {r.density_percentage}%
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.congestion_level === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      r.congestion_level === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      r.congestion_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {r.congestion_level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px]">
                      {r.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(r)}
                      className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                      title="Edit Record"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      title="Delete Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {records.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    No crowd records found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.pages > 1 && (
          <div className="p-3 bg-slate-900/60 border-t border-slate-700/80 flex items-center justify-between text-xs text-slate-400">
            <span>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-1.5">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchRecords(pagination.page - 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => fetchRecords(pagination.page + 1)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-white text-base">
                {modalMode === 'create' ? 'Record New Crowd Entry' : 'Edit Crowd Entry'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Campus Facility</label>
                <select
                  required
                  value={formData.location_id || ''}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="">Select Facility Location</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.building_code} - Cap: {b.capacity})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Crowd Count (People)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.crowd_count}
                    onChange={(e) => setFormData({ ...formData, crowd_count: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Live Density & Congestion Calculation Preview */}
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 space-y-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Automated Calculation Preview:
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Density Ratio:</span>
                  <span className="font-mono font-bold text-white">{computedDensity}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Congestion Level:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    computedCongestion === 'CRITICAL' ? 'bg-red-500 text-white' :
                    computedCongestion === 'HIGH' ? 'bg-orange-500 text-white' :
                    computedCongestion === 'MEDIUM' ? 'bg-yellow-400 text-slate-900' :
                    'bg-emerald-500 text-white'
                  }`}>
                    {computedCongestion}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Data Source Tag</label>
                <select
                  value={formData.source || 'MANUAL_ENTRY'}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="MANUAL_ENTRY">MANUAL_ENTRY (Admin Log)</option>
                  <option value="SIMULATION">SIMULATION (Synthetic Stream)</option>
                  <option value="SENSOR_FEED">SENSOR_FEED (Simulated Camera/IoT)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all"
                >
                  {submitting ? 'Saving...' : modalMode === 'create' ? 'Record Entry' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrowdManagement;
