import { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, Mail, Phone, MapPin, X, Clock, CreditCard, ChevronRight, Package, ShoppingBag, CheckCircle, AlertCircle, Sparkles, RefreshCw, Bot, Send } from 'lucide-react';
import { getVendors, addVendor, deleteVendor, getPurchaseOrders, getAIRestockDraft, createPurchaseOrder, cancelPurchaseOrder } from '../utils/api';
import toast from 'react-hot-toast';
import { usePollingData } from '../hooks/usePollingData';

export default function ManageVendors() {
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendors, setVendors] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', averageLeadTime: 3 });
  const [saving, setSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);

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
        items: aiDraft.items.map(item => ({
          medicineId: item.medicineId,
          quantity: item.suggestedQuantity,
          costPrice: item.costPrice
        })),
        totalCost: aiDraft.totalCost,
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

  const handleCancelPO = async (id) => {
    if (!confirm('Are you sure you want to cancel this purchase order? An email notification will be sent to the vendor.')) return;
    try {
      await cancelPurchaseOrder(id);
      toast.success('Purchase order cancelled');
      poRefetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel order');
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
                  <div className="stat-value">Procurement</div>
                </div>
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
              <div className="draft-header-card card">
                <div className="ai-badge">
                  <Sparkles size={14} /> AI GENERATED DRAFT
                </div>
                <div className="vendor-summary">
                  <Building2 size={24} />
                  <div>
                    <h4>Primary Vendor: {aiDraft.vendor.name}</h4>
                    <p>{aiDraft.vendor.email}</p>
                  </div>
                </div>
                <div className="total-summary">
                  <div className="label">Total Order Value</div>
                  <div className="value">{formatCurrency(aiDraft.totalCost)}</div>
                </div>
                <div className="draft-actions">
                  <button className="btn btn-secondary" onClick={handleGenerateDraft}>
                    <RefreshCw size={14} /> Re-Draft
                  </button>
                  <button className="btn btn-primary" onClick={handleApprovePO} disabled={saving}>
                    {saving ? 'Processing...' : 'Approve & Send PO'} <Send size={14} style={{ marginLeft: 8 }} />
                  </button>
                </div>
              </div>

              <div className="card mt-20">
                <div className="card-header">
                  <h3>Restock Items ({aiDraft.items.length})</h3>
                </div>
                <div className="card-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Current Stock</th>
                        <th>Reorder Level</th>
                        <th>Suggested Order</th>
                        <th>Cost Price (Unit)</th>
                        <th>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiDraft.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-bold">{item.name}</td>
                          <td>{item.currentStock}</td>
                          <td style={{ color: 'var(--accent-red)' }}>{item.reorderLevel}</td>
                          <td style={{ color: 'var(--brand)', fontWeight: 700 }}>+{item.suggestedQuantity}</td>
                          <td>{formatCurrency(item.costPrice)}</td>
                          <td className="font-bold">{formatCurrency(item.costPrice * item.suggestedQuantity)}</td>
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
                  {purchaseOrders.map((po) => (
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
      `}</style>
    </div>
  );
}
