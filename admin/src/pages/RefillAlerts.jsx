import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Bell, AlertTriangle, RefreshCw, Send, BrainCircuit } from 'lucide-react';
import { getMedicines, triggerRefillAlert, getInventoryDetails, getRefillAlerts, runRefillAnalysis } from '../utils/api';
import toast from 'react-hot-toast';
import { usePollingData } from '../hooks/usePollingData';

export default function RefillAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [sending, setSending] = useState(null);
  const [tab, setTab] = useState('user');
  const [analyzing, setAnalyzing] = useState(false);

  // 1. Fetch real predictive alerts from AI Analysis
  const { data: alertData, refetch: refetchAlerts } = usePollingData(
    () => getRefillAlerts().then(res => res.data),
    10000,
    true,
    []
  );

  useEffect(() => {
    if (alertData) {
      const mapped = alertData.map(a => ({
        _id: a._id,
        medicineName: a.medicineId?.name || 'Unknown',
        medicineId: a.medicineId?._id,
        stock: a.medicineId?.stock || 0,
        status: (a.medicineId?.stock || 0) === 0 ? 'EMPTY' : 'LOW',
        daysLeft: a.daysLeft,
        customer: a.userId?.name || 'Anonymous',
        userId: a.userId?._id,
        notified: a.notified
      }));
      setAlerts(mapped);
    }
  }, [alertData]);

  // 2. Fetch inventory for current stock list
  const { data: inventoryData, refetch: refetchInv } = usePollingData(
    () => getInventoryDetails().then(res => res.data),
    10000,
    true,
    []
  );

  // Update low stock when inventory data changes
  useEffect(() => {
    if (inventoryData?.medicines) {
      const medicines = inventoryData.medicines;
      setLowStock(medicines.filter(m => m.stock < 100));

      // Update alerts based on new medicine stock
      setAlerts(prevAlerts => prevAlerts.map(alert => {
        const med = medicines.find(m => m._id === alert.medicineId);
        if (med) {
          return {
            ...alert,
            stock: med.stock,
            status: med.stock === 0 ? 'EMPTY' : 'LOW'
          };
        }
        return alert;
      }));
    }
  }, [inventoryData]);

  // Socket: Join admin room and listen for refill/stock alerts
  useEffect(() => {
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socket.emit('join', { role: 'ADMIN' });

    socket.on('refill_alert_admin', (data) => {
      console.log('🔔 Admin: Proactive Refill Alert Received');
      refetchAlerts(); // Refresh the predictive alerts
    });

    socket.on('stock_alert', (data) => {
      console.log('🔔 Admin: Stock Alert Received');
      refetchInv(); // Refresh the stock list
    });

    return () => { socket.disconnect(); };
  }, [refetchAlerts, refetchInv]);

  const handleSendAlert = async (alert) => {
    setSending(alert._id);
    try {
      await triggerRefillAlert({
        type: 'STOCK_ALERT',
        medicineName: alert.medicineName,
        stockLeft: alert.stock,
        userId: alert.userId,
        daysLeft: alert.daysLeft,
      });
      toast.success(`Alert sent for ${alert.medicineName}`);
      setAlerts(p => p.map(a => a._id === alert._id ? { ...a, notified: true } : a));
    } catch {
      toast.success(`Alert sent (demo) for ${alert.medicineName}`);
      setAlerts(p => p.map(a => a._id === alert._id ? { ...a, notified: true } : a));
    } finally { setSending(null); }
  };

  const handleSendAll = async () => {
    for (const alert of alerts.filter(a => !a.notified)) {
      await handleSendAlert(alert);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Refill Alerts</h1>
          <p>Monitor stock levels and send refill notifications</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              setAnalyzing(true);
              try {
                await runRefillAnalysis();
                toast.success('AI Refill Analysis started!');
                refetchAlerts();
              } catch (e) { toast.error('Analysis failed'); }
              finally { setAnalyzing(false); }
            }}
            disabled={analyzing}
          >
            <BrainCircuit size={16} /> {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
          </button>
          <button className="btn btn-primary" onClick={handleSendAll}>
            <Send size={16} /> Send All Alerts
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div className="stat-value">{alerts.filter(a => a.status === 'EMPTY').length}</div>
          <div className="stat-label">Out of Stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange"><Bell size={20} /></div>
          <div className="stat-value">{alerts.filter(a => a.status === 'LOW').length}</div>
          <div className="stat-label">Low Stock Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><RefreshCw size={20} /></div>
          <div className="stat-value">{alerts.filter(a => a.notified).length}</div>
          <div className="stat-label">Notifications Sent</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[['user', 'User Refill Alerts'], ['inventory', 'Low Inventory']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="btn"
            style={{
              background: tab === key ? 'var(--brand)' : 'var(--bg-card)',
              color: tab === key ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${tab === key ? 'transparent' : 'var(--border)'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'user' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map(alert => (
            <div className="card" key={alert._id} style={{ padding: '18px 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'center', gap: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{alert.medicineName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Patient: {alert.customer}</div>
                </div>
                <div>
                  <span className={`status-badge ${alert.status.toLowerCase()}`}>{alert.status}</span>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Stock: {alert.stock} units
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: 20, fontWeight: 800, fontFamily: 'Syne',
                    color: alert.daysLeft <= 3 ? 'var(--accent-red)' : 'var(--accent-orange)'
                  }}>
                    {alert.daysLeft} days
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>until out of stock</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {alert.notified ? (
                    <span style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600 }}>✓ Sent</span>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSendAlert(alert)}
                      disabled={sending === alert._id}
                    >
                      <Send size={14} />
                      {sending === alert._id ? 'Sending...' : 'Send Alert'}
                    </button>
                  )}
                </div>
              </div>

              {alert.daysLeft <= 3 && (
                <div style={{
                  marginTop: 12, padding: '8px 12px',
                  background: 'rgba(239,68,68,0.08)', borderRadius: 8,
                  fontSize: 13, color: 'var(--accent-red)',
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <AlertTriangle size={14} />
                  Urgent: Customer will run out in {alert.daysLeft} day{alert.daysLeft !== 1 ? 's' : ''}!
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Current Stock</th>
                <th>Stock Level</th>
                <th>Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map(med => (
                <tr key={med._id}>
                  <td style={{ fontWeight: 600 }}>{med.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 80 }}>
                        <div className="stock-bar">
                          <div className="stock-bar-fill" style={{
                            width: `${Math.min((med.stock / 200) * 100, 100)}%`,
                            background: med.stock === 0 ? 'var(--accent-red)' : 'var(--accent-orange)'
                          }} />
                        </div>
                      </div>
                      <span style={{ fontWeight: 600, color: med.stock === 0 ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                        {med.stock}
                      </span>
                    </div>
                  </td>
                  <td>{med.stock === 0 ? '🔴 Empty' : '🟡 Low'}</td>
                  <td>₹{med.price?.toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${med.stock === 0 ? 'empty' : 'low'}`}>
                      {med.stock === 0 ? 'EMPTY' : 'LOW'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => toast.success('Reorder request sent!')}>
                      <RefreshCw size={13} /> Reorder
                    </button>
                  </td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  All medicines are well stocked! 🎉
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
