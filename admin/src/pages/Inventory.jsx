import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Search, X, TrendingUp, DollarSign } from 'lucide-react';
import { getMedicines, addMedicine, updateMedicine, getInventoryDetails } from '../utils/api';
import toast from 'react-hot-toast';
import { usePollingData } from '../hooks/usePollingData';
import LoadingSkeleton from '../components/LoadingSkeleton';

const emptyForm = { name: '', dosage: '', unitType: 'tablets', stock: '', price: '', costPrice: '', prescriptionRequired: false };

export default function Inventory() {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceForm, setPriceForm] = useState({ costPrice: 0, price: 0 });

  // Use polling hook for real-time inventory updates (every 10 seconds)
  const { data: inventoryData, loading, error, refetch } = usePollingData(
    () => getInventoryDetails().then(res => res.data),
    10000,
    true,
    []
  );

  // Update medicines when inventory data changes
  useEffect(() => {
    if (inventoryData?.medicines) {
      setMedicines(inventoryData.medicines);
    }
  }, [inventoryData]);

  // Fallback: fetch medicines if polling fails
  const fetchMedicines = async () => {
    try {
      const res = await getMedicines();
      setMedicines(res.data || []);
    } catch {
      setMedicines([
        { _id: '1', name: 'Dolo 650', dosage: '650mg', unitType: 'tablets', stock: 100, price: 2550, prescriptionRequired: false },
        { _id: '2', name: 'Metformin', dosage: '500mg', unitType: 'tablets', stock: 50, price: 15000, prescriptionRequired: true },
        { _id: '3', name: 'Amoxicillin 500mg', dosage: '500mg', unitType: 'capsules', stock: 0, price: 8500, prescriptionRequired: true },
        { _id: '4', name: 'Lisinopril 10mg', dosage: '10mg', unitType: 'tablets', stock: 85, price: 12000, prescriptionRequired: true },
        { _id: '5', name: 'Paracetamol', dosage: '500mg', unitType: 'tablets', stock: 500, price: 1500, prescriptionRequired: false },
        { _id: '6', name: 'Omeprazole', dosage: '20mg', unitType: 'capsules', stock: 120, price: 3200, prescriptionRequired: false },
      ]);
    }
  };

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (med) => {
    setEditing(med);
    setForm({
      ...med,
      costPrice: med.costPrice ?? 0
    });
    setShowModal(true);
  };

  const openPriceUpdate = (med) => {
    setEditing(med);
    setPriceForm({
      costPrice: med.costPrice || 0,
      price: med.price || 0
    });
    setShowPriceModal(true);
  };

  const handlePriceSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        costPrice: Number(priceForm.costPrice),
        price: Number(priceForm.price)
      };
      const res = await updateMedicine(editing._id, payload);
      setMedicines(prev => prev.map(m => m._id === editing._id ? res.data : m));
      toast.success('Prices updated!');
      setShowPriceModal(false);
      refetch();
    } catch (error) {
      toast.error('Failed to update prices');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      console.log('--- SAVE START ---');
      console.log('Form State Raw:', form);
      const payload = {
        name: form.name,
        dosage: form.dosage,
        unitType: form.unitType,
        stock: Number(form.stock),
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        prescriptionRequired: !!form.prescriptionRequired
      };
      console.log('Final Payload prepared:', payload);

      console.log('Sending Update Payload:', payload);

      if (editing) {
        const res = await updateMedicine(editing._id, payload);
        setMedicines(prev => prev.map(m => m._id === editing._id ? res.data : m));
        toast.success('Medicine updated!');
      } else {
        const res = await addMedicine(payload);
        setMedicines(prev => [...prev, res.data]);
        toast.success('Medicine added!');
      }
      setShowModal(false);
      refetch(); // Still refetch to sync background analytics
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes. Please try again.');
      setShowModal(false);
    } finally { setSaving(false); }
  };

  const getStockStatus = (stock) => {
    if (stock === 0) return 'EMPTY';
    if (stock < 100) return 'LOW';
    return 'OK';
  };

  const getStockColor = (stock) => {
    if (stock === 0) return 'var(--accent-red)';
    if (stock < 100) return 'var(--accent-orange)';
    return 'var(--accent-green)';
  };

  const filtered = medicines.filter(m => {
    const matchSearch = m.name?.toLowerCase().includes(search.toLowerCase());
    if (filter === 'low') return matchSearch && m.stock < 100;
    if (filter === 'empty') return matchSearch && m.stock === 0;
    if (filter === 'prescription') return matchSearch && m.prescriptionRequired;
    return matchSearch;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Inventory</h1>
          <p>Manage medicines and stock levels</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Medicine
        </button>
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input-sm"
            style={{ paddingLeft: 32, width: '100%' }}
            placeholder="Search medicines..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Medicines</option>
          <option value="low">Low Stock</option>
          <option value="empty">Out of Stock</option>
          <option value="prescription">Prescription Required</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filtered.length} medicines
        </span>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSkeleton type="table" count={5} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Dosage</th>
                <th>Unit Type</th>
                <th>Stock</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Unit Profit</th>
                <th>Rx Required</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(med => (
                <tr key={med._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{med.name}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{med.dosage}</td>
                  <td style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{med.unitType}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, maxWidth: 80 }}>
                        <div className="stock-bar">
                          <div
                            className="stock-bar-fill"
                            style={{
                              width: `${Math.min((med.stock / 500) * 100, 100)}%`,
                              background: getStockColor(med.stock)
                            }}
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: getStockColor(med.stock) }}>
                        {med.stock}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>₹{med.costPrice?.toLocaleString() || 0}</td>
                  <td style={{ fontWeight: 600 }}>₹{med.price?.toLocaleString()}</td>
                  <td style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                    ₹{(med.price - (med.costPrice || 0)).toLocaleString()}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: med.prescriptionRequired ? 'var(--accent-orange)' : 'var(--text-muted)'
                    }}>
                      {med.prescriptionRequired ? 'Required' : 'No'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${getStockStatus(med.stock).toLowerCase()}`}>
                      {getStockStatus(med.stock)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => openPriceUpdate(med)}
                      title="Update Price"
                      style={{ color: 'var(--brand)' }}
                    >
                      <TrendingUp size={14} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => openEdit(med)}
                      title="Full Edit"
                    >
                      <Edit size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <Package size={40} />
            <p>No medicines found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editing ? 'Edit Medicine' : 'Add New Medicine'}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Medicine Name</label>
                  <input className="form-control" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Paracetamol 500mg" />
                </div>
                <div className="form-group">
                  <label className="form-label">Dosage</label>
                  <input className="form-control" value={form.dosage} onChange={e => setForm(p => ({ ...p, dosage: e.target.value }))} required placeholder="e.g. 500mg" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit Type</label>
                  <select className="form-control" value={form.unitType} onChange={e => setForm(p => ({ ...p, unitType: e.target.value }))}>
                    <option value="tablets">Tablets</option>
                    <option value="capsules">Capsules</option>
                    <option value="ml">ML</option>
                    <option value="strips">Strips</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Stock (Units)</label>
                  <input type="number" className="form-control" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} required min="0" placeholder="100" />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (₹ Buy)</label>
                  <input type="number" className="form-control" value={form.costPrice} onChange={e => setForm(p => ({ ...p, costPrice: e.target.value }))} required min="0" placeholder="2000" />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹ Sell)</label>
                  <input type="number" className="form-control" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} required min="0" placeholder="2550" />
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.prescriptionRequired}
                    onChange={e => setForm(p => ({ ...p, prescriptionRequired: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                  />
                  <span className="form-label" style={{ margin: 0 }}>Prescription Required</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editing ? 'Update Medicine' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Price Update Modal */}
      {showPriceModal && (
        <div className="modal-overlay" onClick={() => setShowPriceModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><TrendingUp size={18} /> Update Pricing: {editing?.name}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowPriceModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handlePriceSave}>
              <div className="form-group">
                <label className="form-label">Purchase / Cost Price (₹)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="form-control"
                    value={priceForm.costPrice}
                    onChange={e => setPriceForm(p => ({ ...p, costPrice: e.target.value }))}
                    required
                    min="0"
                    placeholder="Enter buying price"
                    style={{ paddingLeft: '30px' }}
                  />
                  <DollarSign size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  The price at which you purchased this item from the vendor.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price (₹)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    className="form-control"
                    value={priceForm.price}
                    onChange={e => setPriceForm(p => ({ ...p, price: e.target.value }))}
                    required
                    min="0"
                    placeholder="Enter selling price"
                    style={{ paddingLeft: '30px' }}
                  />
                  <TrendingUp size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="profit-preview" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Gross Margin:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                    ₹{(priceForm.price - priceForm.costPrice).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Margin Percentage:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {priceForm.price > 0 ? ((priceForm.price - priceForm.costPrice) / priceForm.price * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPriceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Updating...' : 'Save Prices'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
