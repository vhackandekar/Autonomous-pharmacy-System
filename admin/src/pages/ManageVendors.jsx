import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Trash2, Building2, Mail, Phone, MapPin, X, Clock, CreditCard, ChevronRight, Package, ShoppingBag, CheckCircle, AlertCircle, Sparkles, RefreshCw, Bot, Send, Search } from 'lucide-react';
import { getVendors, addVendor, deleteVendor, getPurchaseOrders, getAIRestockDraft, createPurchaseOrder, cancelPurchaseOrder, getMedicines, addMedicineToVendor, removeMedicineFromVendor } from '../utils/api';
import toast from 'react-hot-toast';
import { usePollingData } from '../hooks/usePollingData';

export default function ManageVendors() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'vendors');
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', averageLeadTime: 3 });
  const [saving, setSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [draftItems, setDraftItems] = useState([]);
  const [generatingDraft, setGeneratingDraft] = useState(false);

  // Vendor Medicine Management States
  const [showMedModal, setShowMedModal] = useState(false);
  const [selectedVendorForMeds, setSelectedVendorForMeds] = useState(null);
  const [allMedicines, setAllMedicines] = useState([]);
  const [medSearch, setMedSearch] = useState('');
  const [managingMeds, setManagingMeds] = useState(false);

  const { data: vendorsData, loading: vLoading, refetch: vRefetch } = usePollingData(
    () => getVendors().then(res => res.data),
    10000,
    true,
    []
  );

  const { data: poData, loading: poLoading, refetch: poRefetch } = usePollingData(
    () => getPurchaseOrders().then(res => res.data),
    15000,
    activeTab === 'purchases',
    []
  );

  useEffect(() => {
    if (vendorsData && Array.isArray(vendorsData)) setVendors(vendorsData);
  }, [vendorsData]);

  useEffect(() => {
    if (poData && Array.isArray(poData)) setPurchaseOrders(poData);
  }, [poData]);

  // If we land on ai-restock tab, trigger the draft automatically
  useEffect(() => {
    if (activeTab === 'ai-restock' && !aiDraft) {
      handleGenerateDraft();
    }
  }, [activeTab]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addVendor(form);
      toast.success('Vendor added successfully!');
      setForm({ name: '', email: '', phone: '', address: '', averageLeadTime: 3 });
      setShowModal(false);
      vRefetch();
    } catch {
      toast.error('Failed to add vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this vendor? All associated purchase data will remain in history.')) return;
    try {
      await deleteVendor(id);
      toast.success('Vendor removed!');
      vRefetch();
    } catch {
      toast.error('Failed to remove vendor');
    }
  };

  const formatCurrency = (val) => `₹${Number(val).toLocaleString('en-IN')}`;

  const handleGenerateDraft = async () => {
    setGeneratingDraft(true);
    try {
      const res = await getAIRestockDraft();
      setAiDraft(res.data);
      setDraftItems(res.data.items || []);
      if (res.data.items?.length === 0) {
        toast.success(res.data.message || 'Inventory is healthy!');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate AI restock draft';
      toast.error(msg);
      console.error('Restock Draft UI Error:', err);
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleApprovePO = async () => {
    if (!aiDraft || !aiDraft.success) return;
    setSaving(true);
    try {
      const payload = {
        vendorId: aiDraft.vendor._id,
        items: draftItems.map(item => ({
          medicineId: item.medicineId,
          quantity: item.suggestedQuantity,
          costPrice: item.costPrice
        })),
        totalCost: draftItems.reduce((sum, item) => sum + (item.suggestedQuantity * item.costPrice), 0),
        status: 'Pending',
        paymentStatus: 'Pending'
      };

      await createPurchaseOrder(payload);
      toast.success('Purchase Order Created & Sent to Vendor!');
      setAiDraft(null);
      setActiveTab('purchases');
      poRefetch();
    } catch {
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const updateDraftItemQty = (idx, val) => {
    const newItems = [...draftItems];
    newItems[idx].suggestedQuantity = Number(val);
    setDraftItems(newItems);
  };

  const removeDraftItem = (idx) => {
    setDraftItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCancelPO = async (id) => {
    if (!confirm('Are you sure you want to cancel this purchase order? An email notification will be sent to the vendor.')) return;
    try {
      await cancelPurchaseOrder(id);
      // Immediately remove from UI for better responsiveness
      setPurchaseOrders(prev => prev.filter(o => o._id !== id));
      toast.success('Purchase order cancelled');
      poRefetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  const openMedicineManager = async (vendor) => {
    setSelectedVendorForMeds(vendor);
    setShowMedModal(true);
    setManagingMeds(true);
    try {
      const res = await getMedicines();
      setAllMedicines(res.data);
    } catch {
      toast.error('Failed to load medicines');
    } finally {
      setManagingMeds(false);
    }
  };

  const handleAddMedToVendor = async (medicine) => {
    if (!selectedVendorForMeds) return;
    try {
      const res = await addMedicineToVendor(selectedVendorForMeds._id, [medicine._id]);
      setSelectedVendorForMeds(res.data);
      // Update global vendors list to reflect change
      setVendors(prev => prev.map(v => v._id === res.data._id ? res.data : v));
      toast.success(`${medicine.name} added to ${selectedVendorForMeds.name}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to add medicine';
      toast.error(msg);
      console.error('Medicine Add Error:', err);
    }
  };

  const handleRemoveMedFromVendor = async (medicineId) => {
    if (!selectedVendorForMeds) return;
    try {
      const res = await removeMedicineFromVendor(selectedVendorForMeds._id, medicineId);
      setSelectedVendorForMeds(res.data);
      // Update global vendors list
      setVendors(prev => prev.map(v => v._id === res.data._id ? res.data : v));
      toast.success('Medicine removed from supplier list');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to remove medicine';
      toast.error(msg);
      console.error('Medicine Remove Error:', err);
    }
  };

  return (
    <div className="manage-vendors-page">
      <div className="page-header">
        <div className="header-info">
          <h1>Vendor & Procurement Management</h1>
          <p>Streamline supplier relationships and purchase order workflows</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add New Vendor
          </button>
        </div>
      </div>

      <div className="vendors-tabs">
        <button
          className={`tab-btn ${activeTab === 'vendors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendors')}
        >
          <Building2 size={18} />
          <span>Active Vendors ({vendors.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          <ShoppingBag size={18} />
          <span>Purchase Orders</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'ai-restock' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('ai-restock');
            if (!aiDraft) handleGenerateDraft();
          }}
        >
          <Sparkles size={18} />
          <span>Smart Restock</span>
        </button>
      </div>

      {activeTab === 'vendors' ? (
        <div className="vendors-grid">
          {vendors.map((vendor) => (
            <div key={vendor._id} className="vendor-card-premium">
              <div className="card-top">
                <div className="vendor-icon">
                  <Building2 size={24} />
                </div>
                <div className="vendor-status active">Active</div>
                <button className="delete-vendor-btn" onClick={() => handleDelete(vendor._id)}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="vendor-body">
                <h3>{vendor.name}</h3>
                <div className="vendor-info-list">
                  <div className="info-item">
                    <Mail size={14} />
                    <span>{vendor.email}</span>
                  </div>
                  <div className="info-item">
                    <Phone size={14} />
                    <span>{vendor.phone}</span>
                  </div>
                  <div className="info-item">
                    <MapPin size={14} />
                    <span>{vendor.address || 'Address not set'}</span>
                  </div>
                </div>
              </div>

              <div className="vendor-stats-footer">
                <div className="stat-box">
                  <Clock size={14} />
                  <div className="stat-label">Lead Time</div>
                  <div className="stat-value">{vendor.averageLeadTime || 3} Days</div>
                </div>
                <div className="stat-box">
                  <Package size={14} />
                  <div className="stat-label">Items</div>
                  <div className="stat-value">{vendor.medicines?.length || 0} Products</div>
                </div>
              </div>

              <div className="card-actions-row">
                <button className="btn btn-secondary btn-full" onClick={() => openMedicineManager(vendor)}>
                  <Plus size={14} /> Manage Products
                </button>
              </div>
            </div>
          ))}

          {vendors.length === 0 && !vLoading && (
            <div className="empty-vendors">
              <Building2 size={48} />
              <h3>No Vendors Registered</h3>
              <p>Start by adding your first medicine supplier.</p>
            </div>
          )}
        </div>
      ) : activeTab === 'ai-restock' ? (
        <div className="ai-restock-view">
          {!aiDraft && !generatingDraft ? (
            <div className="empty-state-card card">
              <Bot size={48} />
              <h3>Inventory Intelligence Ready</h3>
              <p>Click below to let AI analyze your stock levels and draft a restock plan.</p>
              <button className="btn btn-primary" onClick={handleGenerateDraft}>
                Analyze & Draft PO
              </button>
            </div>
          ) : generatingDraft ? (
            <div className="loading-state-card card">
              <RefreshCw size={40} className="spin" />
              <h3>Analyzing Sales Velocity...</h3>
              <p>Finding low stock items and best vendor match.</p>
            </div>
          ) : aiDraft?.items?.length === 0 ? (
            <div className="empty-state-card card">
              <CheckCircle size={48} style={{ color: 'var(--accent-green)' }} />
              <h3>Inventory Healthy</h3>
              <p>{aiDraft.message}</p>
              <button className="btn btn-secondary" onClick={handleGenerateDraft}>
                <RefreshCw size={14} style={{ marginRight: 8 }} /> Re-Analyze
              </button>
            </div>
          ) : (
            <div className="draft-container">
              <div className="decision-logic-banner">
                <div className="logic-icon"><Bot size={20} /></div>
                <div className="logic-text">
                  <h4>AI Decision Logic</h4>
                  <p>{aiDraft.reasoning}</p>
                </div>
                <div className="logic-comparison">
                  {aiDraft.allEvaluations?.map((ev, i) => (
                    <div key={i} className={`comparison-item ${ev.isBest ? 'best' : ''}`}>
                      <span className="ev-name">{ev.name}</span>
                      <span className="ev-stats">{ev.matched} items matched • {ev.leadTime}d lead</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="draft-header-card card">
                <div className="ai-badge">
                  <Sparkles size={14} /> AI GENERATED DRAFT
                </div>
                <div className="vendor-summary">
                  <Building2 size={24} />
                  <div>
                    <h4>Primary Vendor: {aiDraft.vendor.name}</h4>
                    <p>{aiDraft.vendor.email} • Estimated Lead Time: {aiDraft.vendor.leadTime} Days</p>
                  </div>
                </div>
                <div className="total-summary">
                  <div className="label">Current Order Value</div>
                  <div className="value">{formatCurrency(draftItems.reduce((sum, item) => sum + (item.suggestedQuantity * item.costPrice), 0))}</div>
                </div>
                <div className="draft-actions">
                  <button className="btn btn-secondary" onClick={handleGenerateDraft}>
                    <RefreshCw size={14} /> Re-Draft
                  </button>
                  <button className="btn btn-primary" onClick={handleApprovePO} disabled={saving || draftItems.length === 0}>
                    {saving ? 'Processing...' : 'Approve & Send PO'} <Send size={14} style={{ marginLeft: 8 }} />
                  </button>
                </div>
              </div>

              <div className="card mt-20">
                <div className="card-header">
                  <h3>Editable Restock Items ({draftItems.length})</h3>
                </div>
                <div className="card-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current Stock</th>
                        <th>Reorder Level</th>
                        <th style={{ width: '150px' }}>Order Quantity</th>
                        <th>Cost Price (Unit)</th>
                        <th>Line Total</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-bold">{item.name}</td>
                          <td>{item.currentStock}</td>
                          <td style={{ color: 'var(--accent-red)' }}>{item.reorderLevel}</td>
                          <td>
                            <input
                              type="number"
                              className="qty-edit-input"
                              value={item.suggestedQuantity}
                              onChange={(e) => updateDraftItemQty(idx, e.target.value)}
                              min="1"
                            />
                          </td>
                          <td>{formatCurrency(item.costPrice)}</td>
                          <td className="font-bold">{formatCurrency(item.costPrice * item.suggestedQuantity)}</td>
                          <td>
                            <button className="btn-icon-danger" onClick={() => removeDraftItem(idx)} title="Remove from order">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="purchases-view">
          <div className="card">
            <div className="card-header">
              <h3>Recent Purchase History</h3>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO ID</th>
                    <th>Vendor</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders
                    .filter(po => po.status !== 'Cancelled')
                    .map((po) => (
                      <tr key={po._id}>
                        <td>#{po._id.slice(-6).toUpperCase()}</td>
                        <td>{po.vendorId?.name}</td>
                        <td>{new Date(po.orderDate).toLocaleDateString()}</td>
                        <td>{po.items?.length || 0} Products</td>
                        <td className="font-bold">{formatCurrency(po.totalCost)}</td>
                        <td>
                          <span className={`status-badge ${po.status?.toLowerCase() === 'delivered' ? 'confirmed' :
                            po.status?.toLowerCase() === 'cancelled' ? 'cancelled' : 'pending'
                            }`}>
                            {po.status || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${po.paymentStatus?.toLowerCase() === 'paid' ? 'processing' : 'rejected'}`}>
                            {po.paymentStatus || 'Pending'}
                          </span>
                        </td>
                        <td>
                          {po.status !== 'Cancelled' && po.status !== 'Delivered' && (
                            <button
                              className="btn-text-danger"
                              onClick={() => handleCancelPO(po._id)}
                              title="Cancel Order"
                            >
                              <X size={14} /> Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  {purchaseOrders.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                        No purchase orders found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Plus size={18} /> Add New Vendor</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="vendor-form">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Supplier Name</label>
                  <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Reliance Medicals" />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="sales@supplier.com" />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 000 000 0000" />
                </div>
                <div className="form-group full">
                  <label>Business Address</label>
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Pharma Plaza, Mumbai" />
                </div>
                <div className="form-group">
                  <label>Average Lead Time (Days)</label>
                  <input type="number" required value={form.averageLeadTime} onChange={e => setForm(p => ({ ...p, averageLeadTime: e.target.value }))} min="1" max="60" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Registering...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )
      }

      {showMedModal && selectedVendorForMeds && (
        <div className="modal-overlay" onClick={() => setShowMedModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-with-subtitle">
                <h3>Manage Products: {selectedVendorForMeds.name}</h3>
                <p>Assign medicines that can be ordered from this supplier</p>
              </div>
              <button className="icon-btn" onClick={() => setShowMedModal(false)}><X size={18} /></button>
            </div>

            <div className="medicine-manager-layout">
              <div className="assigned-medicines">
                <div className="section-title">Supplied Products ({selectedVendorForMeds.medicines?.length || 0})</div>
                <div className="med-list-container">
                  {selectedVendorForMeds.medicines?.map(med => (
                    <div key={med._id} className="med-item assigned">
                      <div className="med-info">
                        <span className="med-name">{med.name}</span>
                        <span className="med-meta">{med.dosage} • {med.unitType}</span>
                      </div>
                      <button className="remove-med-btn" onClick={() => handleRemoveMedFromVendor(med._id)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {(!selectedVendorForMeds.medicines || selectedVendorForMeds.medicines.length === 0) && (
                    <div className="empty-mini">No medicines assigned yet.</div>
                  )}
                </div>
              </div>

              <div className="available-medicines">
                <div className="section-title">Available Inventory</div>
                <div className="search-box-mini">
                  <Search size={14} />
                  <input
                    placeholder="Search medicines to add..."
                    value={medSearch}
                    onChange={e => setMedSearch(e.target.value)}
                  />
                </div>
                <div className="med-list-container">
                  {allMedicines
                    .filter(m => m.name.toLowerCase().includes(medSearch.toLowerCase()))
                    .filter(m => !selectedVendorForMeds.medicines?.find(vm => vm._id === m._id))
                    .map(med => (
                      <div key={med._id} className="med-item available">
                        <div className="med-info">
                          <span className="med-name">{med.name}</span>
                          <span className="med-meta">{med.dosage}</span>
                        </div>
                        <button className="add-med-btn" onClick={() => handleAddMedToVendor(med)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowMedModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .manage-vendors-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .vendors-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: var(--brand);
          background: var(--bg-secondary);
          border-radius: 8px 8px 0 0;
        }

        .tab-btn.active {
          color: var(--brand);
          border-bottom-color: var(--brand);
        }

        .vendors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .vendor-card-premium {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          position: relative;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .vendor-card-premium:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }

        .card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .vendor-icon {
          width: 48px;
          height: 48px;
          background: var(--brand-dim);
          color: var(--brand);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .vendor-status {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 20px;
        }

        .vendor-status.active {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .delete-vendor-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .delete-vendor-btn:hover { opacity: 1; }

        .vendor-body h3 {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .vendor-info-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .info-item svg { color: var(--text-muted); }

        .vendor-stats-footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .stat-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-box svg { color: var(--brand); margin-bottom: 2px; }
        .stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-value { font-size: 14px; font-weight: 700; color: var(--text-primary); }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 0 24px;
        }

        .form-group.full { grid-column: 1 / -1; }
        .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .form-group input { 
          width: 100%; 
          padding: 10px 14px; 
          background: var(--bg-primary); 
          border: 1px solid var(--border); 
          border-radius: 10px; 
          color: var(--text-primary);
        }

        .empty-vendors {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          color: var(--text-muted);
          text-align: center;
        }

        .empty-vendors svg { margin-bottom: 20px; opacity: 0.3; }
        .empty-vendors h3 { color: var(--text-primary); margin-bottom: 8px; }

        .ai-restock-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .empty-state-card, .loading-state-card {
          padding: 80px 40px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .empty-state-card svg, .loading-state-card svg {
          color: var(--brand);
          opacity: 0.8;
          margin-bottom: 10px;
        }

        .loading-state-card svg.spin {
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .draft-header-card {
          display: flex;
          align-items: center;
          gap: 40px;
          padding: 30px;
          position: relative;
          background: linear-gradient(to right, var(--bg-card), var(--bg-hover));
        }

        .ai-badge {
          position: absolute;
          top: 12px;
          right: 20px;
          background: var(--brand);
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 5px;
          letter-spacing: 0.5px;
        }

        .vendor-summary {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }

        .vendor-summary h4 { font-size: 18px; margin-bottom: 4px; }
        .vendor-summary p { font-size: 13px; color: var(--text-muted); }

        .total-summary {
          text-align: right;
          padding: 0 40px;
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
        }

        .total-summary .label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 5px; }
        .total-summary .value { font-size: 24px; font-weight: 800; color: var(--brand); }

        .draft-actions {
          display: flex;
          gap: 10px;
        }

        .mt-20 { margin-top: 20px; }
        .font-bold { font-weight: 700; }

        .decision-logic-banner {
          background: var(--bg-hover);
          border: 1px dashed var(--brand);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 20px;
        }

        .logic-icon {
          background: var(--brand);
          color: white;
          padding: 10px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logic-text h4 { font-size: 14px; color: var(--brand); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
        .logic-text p { font-size: 14px; color: var(--text-primary); line-height: 1.5; }

        .logic-comparison {
          margin-left: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-left: 20px;
          border-left: 1px solid var(--border);
        }

        .comparison-item {
          padding: 4px 12px;
          border-radius: 6px;
          background: var(--bg-primary);
          display: flex;
          flex-direction: column;
          font-size: 11px;
          opacity: 0.6;
        }

        .comparison-item.best {
          background: var(--brand-dim);
          border: 1px solid var(--brand);
          opacity: 1;
        }

        .comparison-item .ev-name { font-weight: 700; color: var(--text-primary); }
        .comparison-item .ev-stats { color: var(--text-muted); }

        .qty-edit-input {
          width: 80px;
          padding: 6px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg-primary);
          color: var(--brand);
          font-weight: 700;
          text-align: center;
        }

        .qty-edit-input:focus {
          border-color: var(--brand);
          outline: none;
          box-shadow: 0 0 0 2px var(--brand-dim);
        }

        .btn-icon-danger {
          background: none;
          border: none;
          color: var(--accent-red);
          cursor: pointer;
          opacity: 0.7;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-icon-danger:hover {
          background: rgba(239, 68, 68, 0.1);
          opacity: 1;
        }
        .btn-text-danger {
          background: none;
          border: none;
          color: #ef4444;
          font-weight: 600;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .btn-text-danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        .card-actions-row {
          margin-top: auto;
          padding-top: 12px;
        }

        .btn-full { width: 100%; justify-content: center; }

        .modal-lg { max-width: 800px; width: 90%; }
        
        .header-with-subtitle p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

        .medicine-manager-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          padding: 0 24px 24px;
          height: 450px;
        }

        .section-title { font-size: 12px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px; }

        .med-list-container {
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 12px;
          height: calc(100% - 30px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .available-medicines .med-list-container { height: calc(100% - 75px); }

        .search-box-mini {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 12px;
        }

        .search-box-mini input { background: none; border: none; font-size: 13px; color: var(--text-primary); width: 100%; }

        .med-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }

        .med-item:hover { background: var(--bg-secondary); }

        .med-info { display: flex; flex-direction: column; gap: 2px; }
        .med-name { font-size: 14px; font-weight: 600; }
        .med-meta { font-size: 11px; color: var(--text-muted); }

        .remove-med-btn { background: none; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; }
        .remove-med-btn:hover { opacity: 1; }

        .add-med-btn { background: var(--brand-dim); color: var(--brand); border: none; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .add-med-btn:hover { background: var(--brand); color: white; }

        .empty-mini { padding: 40px 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
      `}</style>
    </div>
  );
}
