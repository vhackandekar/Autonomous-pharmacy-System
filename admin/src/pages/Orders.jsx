import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { ShoppingCart, Search, Filter, Eye, X } from 'lucide-react';
import { getAllOrders, updateOrderStatus } from '../utils/api';
import toast from 'react-hot-toast';
import { usePollingData } from '../hooks/usePollingData';
import LoadingSkeleton from '../components/LoadingSkeleton';

const mockOrders = [
  { _id: '1', id: 'ORD-8892', userId: { name: 'Sarah Johnson' }, items: [{ medicineId: { name: 'Dolo 650' }, quantity: 2 }], totalAmount: 4500, status: 'PENDING', orderDate: new Date('2024-01-15') },
  { _id: '2', id: 'ORD-8893', userId: { name: 'Michael Chen' }, items: [{ medicineId: { name: 'Metformin' }, quantity: 1 }], totalAmount: 15000, status: 'PROCESSING', orderDate: new Date('2024-01-15') },
  { _id: '3', id: 'ORD-8894', userId: { name: 'Emily Davis' }, items: [{ medicineId: { name: 'Paracetamol' }, quantity: 4 }], totalAmount: 6000, status: 'SHIPPED', orderDate: new Date('2024-01-14') },
  { _id: '4', id: 'ORD-8895', userId: { name: 'David Wilson' }, items: [{ medicineId: { name: 'Omeprazole' }, quantity: 1 }], totalAmount: 3200, status: 'DELIVERED', orderDate: new Date('2024-01-13') },
  { _id: '5', id: 'ORD-8896', userId: { name: 'Jessica Brown' }, items: [{ medicineId: { name: 'Lisinopril' }, quantity: 3 }], totalAmount: 36000, status: 'CONFIRMED', orderDate: new Date('2024-01-15') },
  { _id: '6', id: 'ORD-8897', userId: { name: 'Raj Patel' }, items: [{ medicineId: { name: 'Amoxicillin' }, quantity: 2 }], totalAmount: 17000, status: 'REJECTED', orderDate: new Date('2024-01-15') },
];

const ORDER_STATUSES = ['CONFIRMED', 'IN_WAREHOUSE', 'SHIPPED', 'FULFILLED', 'REJECTED'];

const normalizeStatus = (s) => (s === 'Cancelled' || s === 'REJECTED') ? 'REJECTED' : s;

const statusClass = (s) => {
  const normalized = normalizeStatus(s);
  return normalized?.toLowerCase().replace('_', '_') || 'pending';
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  // Use polling hook for real-time order updates (every 5 seconds - more urgent)
  const { data: ordersData, loading, error, refetch } = usePollingData(
    () => getAllOrders().then(res => res.data),
    5000,
    true,
    []
  );

  // Update orders when polling data changes
  useEffect(() => {
    if (ordersData && Array.isArray(ordersData)) {
      const sorted = [...ordersData].sort((a, b) => {
        const aDate = new Date(a.createdAt || a.orderDate || a.orderDate || 0);
        const bDate = new Date(b.createdAt || b.orderDate || b.orderDate || 0);
        return bDate - aDate;
      });
      setOrders(sorted);
    }
  }, [ordersData]);

  // Socket.IO real-time updates (join admin room)
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socket.emit('join', { role: 'ADMIN' });

    socket.on('order_created', (order) => {
      setOrders(prev => {
        const next = [order, ...(prev || [])];
        return next.sort((a, b) => new Date(b.createdAt || b.orderDate || 0) - new Date(a.createdAt || a.orderDate || 0));
      });
    });

    socket.on('order_updated_admin', (order) => {
      setOrders(prev => {
        const updated = (prev || []).map(o => (o._id === order._id ? order : o));
        return updated.sort((a, b) => new Date(b.createdAt || b.orderDate || 0) - new Date(a.createdAt || a.orderDate || 0));
      });
    });

    socket.on('refill_alert_admin', (notification) => {
      // Keep admin refreshed: refetch polling data to update stats
      refetch && refetch();
    });

    return () => { socket.disconnect(); };
  }, [refetch]);

  const handleStatusUpdate = async (orderId, status) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, status);
      setOrders(p => p.map(o => o._id === orderId ? { ...o, status } : o));
      if (selected?._id === orderId) setSelected(p => ({ ...p, status }));
      toast.success(`Order status updated to ${status}`);
      refetch(); // Refetch to keep data in sync
    } catch {
      setOrders(p => p.map(o => o._id === orderId ? { ...o, status } : o));
      toast.success(`Status updated to ${status} (demo)`);
    } finally { setUpdatingId(null); }
  };

  const filtered = orders.filter(o => {
    const name = o.userId?.name || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
      (o.id || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || normalizeStatus(o.status) === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  return (
    <div>
      <div className="page-header">
        <h1>Orders</h1>
        <p>Manage and track all pharmacy orders</p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 24 }}>
        {['All', ...ORDER_STATUSES].map(s => {
          const label = s === 'All' ? 'All' : s.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, t => t.toUpperCase());
          const count = s === 'All' ? orders.length : orders.filter(o => o.status === s).length;
          return (
            <div
              key={s}
              className="stat-card"
              style={{ cursor: 'pointer', borderColor: statusFilter === (s === 'All' ? 'all' : s) ? 'var(--brand)' : '' }}
              onClick={() => setStatusFilter(s === 'All' ? 'all' : s)}
            >
              <div className="stat-value" style={{ fontSize: 22 }}>
                {s === 'All' ? orders.length : orders.filter(o => normalizeStatus(o.status) === s).length}
              </div>
              <div className="stat-label">{label}</div>
            </div>
          );
        })}
      </div>

      <div className="filters-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="search-input-sm" style={{ paddingLeft: 32 }} placeholder="Search by customer or order ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} orders</span>
      </div>

      <div className="card">
        {loading ? <LoadingSkeleton type="table" count={5} /> : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Update Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(order => (
                  <tr key={order._id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-blue)', fontSize: 13 }}>
                      #{order.id || order._id?.slice(-6)}
                    </td>
                    <td style={{ fontWeight: 500 }}>{order.userId?.name || 'Unknown'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {order.items?.map(i => i.medicineId?.name || 'Medicine').join(', ').substring(0, 20)}...
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      ₹{order.totalAmount?.toLocaleString()}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(order.orderDate).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass(order.status)}`}>{normalizeStatus(order.status)}</span>
                    </td>
                    <td>
                      <select
                        className="filter-select"
                        style={{ padding: '5px 8px', fontSize: 12 }}
                        value={normalizeStatus(order.status)}
                        onChange={e => handleStatusUpdate(order._id, e.target.value)}
                        disabled={updatingId === order._id || order.status === 'Cancelled'}
                      >
                        {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelected(order)}>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty-state"><ShoppingCart size={40} /><p>No orders found</p></div>
            )}
            {totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} className={`page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Order Details — #{selected.id || selected._id?.slice(-6)}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSelected(null)}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              {[
                ['Customer', selected.userId?.name || 'Unknown'],
                ['Status', normalizeStatus(selected.status)],
                ['Order Date', new Date(selected.orderDate).toLocaleDateString('en-IN')],
                ['Total Amount', `₹${selected.totalAmount?.toLocaleString()}`],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Items Ordered
              </div>
              {selected.items?.map((item, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 500 }}>{item.medicineId?.name || 'Medicine'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Qty: {item.quantity}</span>
                  {item.dosagePerDay && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.dosagePerDay}</span>}
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ marginTop: 20 }}>
              <select
                className="filter-select"
                value={normalizeStatus(selected.status)}
                onChange={e => handleStatusUpdate(selected._id, e.target.value)}
                disabled={selected.status === 'Cancelled'}
              >
                {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
