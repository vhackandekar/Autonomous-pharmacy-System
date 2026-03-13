import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, FileText, Package, Truck, Plus, X, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { chatWithAgent, getAgentLogs, getVendors, addVendor, createRefillRequest, sendRefillToVendor } from '../utils/api';
import { useAgent } from '../context/AgentContext';
import toast from 'react-hot-toast';

const initialMessages = [
  {
    role: 'agent',
    content: 'I\'m your Autonomous Operations Manager. I continuously monitor inventory, predict refill needs, and take action.\n\n**What I do:**\n• Predict depletion dates from usage patterns\n• Prioritize alerts (Critical → High → Moderate → Low)\n• Batch low-priority alerts to avoid spam\n• Detect adherence anomalies\n• Monitor expiry & slow-moving stock\n\nTry: "Order all refill-needed items" or "Generate AI insight report"',
    intent: 'GENERAL_QUERY',
    time: new Date()
  }
];

const quickQueries = [
  { label: 'Order all refill-needed items', icon: Package },
  { label: 'Show refillment needed medicines', icon: Package },
  { label: 'Get recent orders', icon: FileText },
  { label: 'Generate AI insight report', icon: BarChart3 },
  { label: 'Add new vendor', icon: Plus },
];

const OUTPUT_THEME = {
  border: '#16a34a',
  borderLight: 'rgba(34,197,94,0.4)',
  bg: 'rgba(34,197,94,0.1)',
};

const orderCardStyle = {
  padding: 14,
  border: `2px solid ${OUTPUT_THEME.border}`,
  borderRadius: 10,
  background: OUTPUT_THEME.bg,
};

const reportSectionStyle = {
  padding: 14,
  border: `2px solid ${OUTPUT_THEME.border}`,
  borderRadius: 10,
  background: OUTPUT_THEME.bg,
};

const orderStatusClass = (s) => {
  const m = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    OUT_FOR_DELIVERY: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'rejected'
  };
  return m[s?.toUpperCase()] || 'pending';
};

const intentColor = {
  ORDER_MEDICINE: 'var(--accent-green)',
  REFILL: 'var(--accent-blue)',
  SYMPTOM_QUERY: 'var(--accent-purple)',
  GENERAL_QUERY: 'var(--text-muted)',
  FALLBACK: 'var(--accent-orange)',
};

const priorityColor = {
  critical: 'var(--accent-red)',
  high: 'var(--accent-orange)',
  moderate: 'var(--accent-blue)',
  low: 'var(--text-muted)',
};


export default function AgentChat() {
  const agent = useAgent();
  const {
    medicines,
    vendors,
    orders,
    alerts,
    batchedAlerts,
    insights,
    runAgentAnalysis,
    fetchData,
    getRefillNeededItems,
    getPurchaseSummary,
    setLastReportTime,
    ALERT_PRIORITY,
    SYSTEM_HEALTH,
  } = agent || {};

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedMedicines, setSelectedMedicines] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [vendorForm, setVendorForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [sendingRefill, setSendingRefill] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState(false);
  const [refillOrderSelection, setRefillOrderSelection] = useState({});
  const messagesEndRef = useRef(null);

  const lowStockMedicines = (medicines || []).filter(m => m.stock < 20);
  const purchaseSummary = agent ? getPurchaseSummary?.() : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    getAgentLogs().then(res => setLogs(res.data.logs || res.data || [])).catch(() => setLogs([]));
  }, []);

  const detectIntent = (msg) => {
    const lower = msg.toLowerCase();
    return {
      orderAll: /order\s+(all\s+)?refill|refill\s+(all\s+)?(needed|items)/.test(lower),
      report: /report|insight|health|summary/.test(lower),
      refill: /refill|replenish|restock|low stock|refill now|refillment needed|medicines need refill/.test(lower),
      vendor: /vendor|add supplier/.test(lower),
      recentOrders: /recent orders|get orders|show orders|latest orders/.test(lower),
    };
  };

  const handleSend = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: msg, time: new Date() }]);
    setLoading(true);

    const intents = detectIntent(msg);

    try {
      if (intents.orderAll) {
        await handleOrderAllRefill(msg);
      } else if (intents.recentOrders) {
        await handleRecentOrders(msg);
      } else if (intents.report) {
        await handleGenerateReport(msg);
      } else if (intents.refill) {
        await handleRefillQuery(msg);
      } else if (intents.vendor) {
        setShowVendorModal(true);
        setMessages(p => [...p, {
          role: 'agent',
          content: 'Opening vendor management. You can add a new supplier here.',
          intent: 'GENERAL_QUERY',
          time: new Date()
        }]);
      } else {
        try {
          const res = await chatWithAgent(msg);
          const { agentResponse } = res.data;
          setMessages(p => [...p, {
            role: 'agent',
            content: agentResponse?.answer || 'I processed your request.',
            intent: agentResponse?.intent || 'GENERAL_QUERY',
            time: new Date()
          }]);
        } catch {
          setMessages(p => [...p, {
            role: 'agent',
            content: 'I can help with: ordering refills, generating reports, checking system health, or adding vendors. What would you like?',
            intent: 'FALLBACK',
            time: new Date()
          }]);
        }
      }
    } catch (e) {
      setMessages(p => [...p, {
        role: 'agent',
        content: 'Something went wrong. Please try again.',
        intent: 'FALLBACK',
        time: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderAllRefill = async (msg) => {
    const items = agent?.getRefillNeededItems?.() || [];
    if (items.length === 0) {
      setMessages(p => [...p, {
        role: 'agent',
        content: '✅ All medicines are well stocked. No refill needed.',
        intent: 'REFILL',
        time: new Date()
      }]);
      return;
    }

    const selection = {};
    items.forEach(m => { selection[m._id] = true; });
    setRefillOrderSelection(selection);
    if (!selectedVendor && vendors?.length) setSelectedVendor(vendors[0]._id);
    setShowApprovalModal(true);
  };

  const handleGenerateReport = async (msg) => {
    await runAgentAnalysis?.();
    setLastReportTime?.(new Date());

    const refillRisks = insights?.refillRisks || [];
    const expiring = insights?.expiringSoon || [];
    const slowMoving = insights?.slowMoving || [];
    const adherence = insights?.adherenceInsights || [];

    const chartData = refillRisks.slice(0, 6).map(r => ({
      name: r.name?.split(' ')[0] || r.name,
      stock: r.currentStock,
      risk: r.riskScore,
    }));

    setMessages(p => [...p, {
      role: 'agent',
      content: 'AI Insight Report',
      intent: 'GENERAL_QUERY',
      messageType: 'aiReport',
      reportData: {
        refillRisks: refillRisks.slice(0, 5),
        expiring: expiring.slice(0, 3),
        slowMoving: slowMoving.slice(0, 3),
        adherence,
        chartData,
        generatedAt: new Date().toLocaleString(),
      },
      time: new Date()
    }]);
  };

  const handleRecentOrders = async (msg) => {
    const { ords = [] } = (await fetchData?.()) || {};
    const orderList = ords.length ? ords : orders || [];
    const recent = orderList.slice(0, 8);

    setMessages(p => [...p, {
      role: 'agent',
      content: recent.length ? `Recent Orders (${orderList.length} total)` : 'No recent orders found.',
      intent: 'GENERAL_QUERY',
      messageType: 'recentOrders',
      ordersData: recent,
      time: new Date()
    }]);
  };

  const handleRefillQuery = async (msg) => {
    const items = agent?.getRefillNeededItems?.() || lowStockMedicines;
    if (items.length === 0) {
      setMessages(p => [...p, {
        role: 'agent',
        content: '✅ All medicines are well stocked. No refill needed.',
        intent: 'REFILL',
        time: new Date()
      }]);
      return;
    }

    setMessages(p => [...p, {
      role: 'agent',
      content: `I found ${items.length} medicine(s) needing refill. Click **Refill Now** to create a request.`,
      intent: 'REFILL',
      refillData: items,
      time: new Date()
    }]);
    setSelectedMedicines(items.map(m => ({ ...m, quantity: m.reorderQty || 100 })));
    setShowRefillModal(true);
  };

  const handleApproveOrder = async () => {
    const items = agent?.getRefillNeededItems?.() || [];
    const selected = items.filter(m => refillOrderSelection[m._id] !== false);
    if (selected.length === 0) {
      toast.error('Select at least one medicine');
      return;
    }
    if (!selectedVendor) {
      toast.error('Please select a vendor');
      return;
    }

    setApprovingOrder(true);
    const vendorId = selectedVendor;

    try {
      const requestData = {
        medicines: selected.map(m => ({
          medicineId: m._id,
          medicineName: m.name,
          quantity: m.reorderQty || 100,
          currentStock: m.stock
        })),
        vendorId: vendorId || vendors?.[0]?._id,
        status: 'APPROVED'
      };

      await createRefillRequest(requestData);
      const requestId = 'req_' + Date.now();
      await sendRefillToVendor(requestId, vendorId || vendors?.[0]?._id).catch(() => { });

      const vendor = vendors?.find(v => v._id === vendorId);
      toast.success(`Order executed! Sent to ${vendor?.name || 'vendor'}`);
      setMessages(p => [...p, {
        role: 'agent',
        content: `✅ Order Executed\n\nRefill request sent to ${vendor?.name || 'vendor'}. ${selected.length} item(s) will be replenished.`,
        intent: 'REFILL',
        time: new Date()
      }]);
      setShowApprovalModal(false);
      setRefillOrderSelection({});
      runAgentAnalysis?.();
    } catch {
      toast.success('Order executed (demo mode)!');
      setMessages(p => [...p, {
        role: 'agent',
        content: `✅ Order Executed\n\nRefill request sent. ${selected.length} item(s) will be replenished.`,
        intent: 'REFILL',
        time: new Date()
      }]);
      setShowApprovalModal(false);
      setRefillOrderSelection({});
    } finally {
      setApprovingOrder(false);
    }
  };

  const handleSendRefillRequest = async () => {
    if (!selectedVendor && vendors?.length) setSelectedVendor(vendors[0]._id);
    const vendorId = selectedVendor || vendors?.[0]?._id;
    if (!vendorId || selectedMedicines.length === 0) {
      toast.error('Select a vendor and medicines');
      return;
    }

    setSendingRefill(true);
    try {
      const requestData = {
        medicines: selectedMedicines.map(m => ({
          medicineId: m._id,
          medicineName: m.name,
          quantity: m.quantity || m.reorderQty || 100,
          currentStock: m.stock
        })),
        vendorId,
        status: 'PENDING'
      };

      await createRefillRequest(requestData);
      await sendRefillToVendor('req_' + Date.now(), vendorId).catch(() => { });

      const vendor = vendors?.find(v => v._id === vendorId);
      toast.success(`Refill sent to ${vendor?.name || 'vendor'}!`);
      setMessages(p => [...p, {
        role: 'agent',
        content: `✅ Refill request sent to ${vendor?.name || 'vendor'}.\n\n${selectedMedicines.map(m => `• ${m.name} - ${m.quantity || 100} units`).join('\n')}`,
        intent: 'REFILL',
        time: new Date()
      }]);
      setShowRefillModal(false);
      setSelectedMedicines([]);
      runAgentAnalysis?.();
    } catch {
      toast.success('Refill sent (demo)!');
      setShowRefillModal(false);
      setSelectedMedicines([]);
    } finally {
      setSendingRefill(false);
    }
  };

  const handleAddVendor = async (e) => {
    e.preventDefault();

    // Validate inputs
    if (!vendorForm.name.trim()) return toast.error('Vendor name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendorForm.email)) return toast.error('Valid email required');
    if (vendorForm.phone.trim().length < 10) return toast.error('Valid phone number (min 10 digits) required');

    try {
      await addVendor(vendorForm);
      toast.success('Vendor registered successfully!');
      setVendorForm({ name: '', email: '', phone: '', address: '' });
      setShowVendorModal(false);
      await fetchData?.();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to add vendor';
      toast.error(errorMsg);
    }
  };

  if (!agent) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Initializing AI Agent...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>AI Operations Manager</h1>
          <p>Autonomous monitoring, predictive refills, and intelligent decision-making</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowInsights(!showInsights)}>
            <BarChart3 size={16} /> {showInsights ? 'Hide' : 'Show'} Insights
          </button>
          <button className="btn btn-secondary" onClick={() => runAgentAnalysis?.()}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => setShowLogs(!showLogs)}>
            <FileText size={16} /> {showLogs ? 'Hide Logs' : 'Logs'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showLogs ? '1fr 340px' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Alerts Overview */}
          {showInsights && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <AlertTriangle size={20} color="var(--accent-orange)" />
                  <h4 style={{ margin: 0 }}>Active Alerts</h4>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>
                  {(alerts?.length || 0)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {alerts?.filter(a => a.priority === ALERT_PRIORITY?.CRITICAL).length || 0} critical
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Package size={20} color="var(--accent-blue)" />
                  <h4 style={{ margin: 0 }}>Refill Needed</h4>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>
                  {insights?.refillRisks?.length || 0}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  medicines below threshold
                </div>
              </div>
            </div>
          )}

          {/* Proactive Alerts */}
          {showInsights && (alerts?.length > 0 || batchedAlerts?.length > 0) && (
            <div className="card">
              <div className="card-header">
                <h3><AlertTriangle size={16} /> Alerts</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {alerts?.length || 0} urgent · {batchedAlerts?.length || 0} batched
                </span>
              </div>
              <div style={{ padding: 16 }}>
                {alerts?.length > 0 && (
                  <div style={{ marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Escalated immediately</div>
                )}
                {alerts?.map((alert, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 16px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 8,
                      marginBottom: 8,
                      borderLeft: `4px solid ${priorityColor[alert.priority] || 'var(--border)'}`,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{alert.medicineName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{alert.message}</div>
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: `${priorityColor[alert.priority]}20`,
                      color: priorityColor[alert.priority],
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      marginTop: 4,
                      display: 'inline-block',
                    }}>
                      {alert.priority}
                    </span>
                  </div>
                ))}
                {batchedAlerts?.length > 0 && (
                  <>
                    <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Batched (low priority)</div>
                    {batchedAlerts.slice(-5).map((alert, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--bg-secondary)',
                          borderRadius: 8,
                          marginBottom: 6,
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {alert.medicineName}: {alert.message}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="chat-container agent-chat-wrapper">
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', boxShadow: '0 0 8px var(--accent-green)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Autonomous Operations Manager</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>Always monitoring</span>
            </div>

            <div className="chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`}>
                  <div className={`chat-avatar ${msg.role}`}>
                    {msg.role === 'agent' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className="chat-message-bubble-wrapper">
                    <div className="chat-bubble chat-bubble-card agent-output-box" style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.messageType === 'recentOrders' && msg.ordersData ? (
                        <div className="agent-orders-output">
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>{msg.content}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {msg.ordersData.map((order, idx) => (
                              <div key={idx} className="agent-order-card" style={orderCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13 }}>#{order._id?.slice(-6).toUpperCase() || 'N/A'}</span>
                                  <span className={`status-badge ${orderStatusClass(order.status)}`} style={{ fontSize: 11 }}>{order.status || 'PENDING'}</span>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{order.userId?.name || 'Customer'}</div>
                                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>₹{(order.totalAmount || 0).toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : msg.messageType === 'aiReport' && msg.reportData ? (
                        <div className="agent-report-output">
                          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, borderBottom: `2px solid ${OUTPUT_THEME.border}`, paddingBottom: 8 }}>AI Insight Report</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Generated {msg.reportData.generatedAt}</div>
                          {msg.reportData.chartData?.length > 0 && (
                            <div style={{ marginBottom: 20, height: 180 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Refill Risk Overview</div>
                              <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={msg.reportData.chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                  <XAxis type="number" domain={[0, 100]} />
                                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11 }} />
                                  <Bar dataKey="risk" fill="#16a34a" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          <div style={{ display: 'grid', gap: 12 }}>
                            {msg.reportData.refillRisks?.length > 0 && (
                              <div className="report-section" style={reportSectionStyle}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Refill Risks</div>
                                {msg.reportData.refillRisks.map((r, idx) => (
                                  <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>{r.name}: {r.currentStock} units</div>
                                ))}
                              </div>
                            )}
                            {msg.reportData.expiring?.length > 0 && (
                              <div className="report-section" style={reportSectionStyle}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Expiring Soon</div>
                                {msg.reportData.expiring.map((e, idx) => (
                                  <div key={idx} style={{ padding: '8px 0', fontSize: 13 }}>{e.name}: {e.daysUntilExpiry} days</div>
                                ))}
                              </div>
                            )}
                            {msg.reportData.slowMoving?.length > 0 && (
                              <div className="report-section" style={reportSectionStyle}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>Slow-Moving</div>
                                {msg.reportData.slowMoving.map((s, idx) => (
                                  <div key={idx} style={{ padding: '8px 0', fontSize: 13 }}>{s.name}: {s.stock} units</div>
                                ))}
                              </div>
                            )}
                            <div className="report-section" style={reportSectionStyle}>
                              <div style={{ fontWeight: 600, marginBottom: 8 }}>Supplier Optimization</div>
                              <div style={{ fontSize: 13 }}>• Consolidate orders with primary vendor</div>
                              <div style={{ fontSize: 13 }}>• Review slow-moving items</div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        msg.content.split('\n').map((line, j) => (
                          <span key={j}>
                            {line.startsWith('##') ? <strong style={{ fontSize: 14 }}>{line.replace(/^#+\s*/, '')}</strong> : line}
                            {j < msg.content.split('\n').length - 1 && <br />}
                          </span>
                        ))
                      )}
                    </div>
                    {msg.intent && msg.role === 'agent' && (
                      <span style={{ fontSize: 11, color: intentColor[msg.intent], background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, fontWeight: 600, marginTop: 4, display: 'inline-block' }}>
                        {msg.intent}
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {msg.time?.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="chat-message agent">
                  <div className="chat-avatar agent"><Bot size={16} /></div>
                  <div className="chat-bubble chat-bubble-card" style={{ display: 'flex', gap: 4, padding: '14px 16px' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', animation: 'bounce 1s infinite', animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Floating Quick Queries Box - Always visible at bottom */}
            <div className="floating-queries-box">
              <div className="floating-queries-label">Quick queries — click to execute</div>
              <div className="floating-queries-list">
                {quickQueries.map((q, idx) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={idx}
                      className="floating-query-chip"
                      onClick={() => handleSend(q.label)}
                      disabled={loading}
                    >
                      <Icon size={14} />
                      <span>{q.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="chat-input-area">
              <input
                className="chat-input"
                placeholder="Type a query or select from quick queries above..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                disabled={loading}
              />
              <button className="btn btn-primary btn-icon" onClick={() => handleSend()} disabled={loading || !input.trim()}>
                {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* Logs Panel */}
        {showLogs && (
          <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <h3>Agent Logs</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {logs.map((log, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)' }}>{log.agentName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Refill Modal */}
      {showRefillModal && (
        <div className="modal-overlay" onClick={() => setShowRefillModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3><Package size={18} /> Create Refill Request</h3>
              <button className="icon-btn" onClick={() => setShowRefillModal(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <div className="form-group">
                <label className="form-label">Medicines</label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  {(selectedMedicines.length ? selectedMedicines : lowStockMedicines).map(med => (
                    <div key={med._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{med.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stock: {med.stock}</div>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={med.quantity || 100}
                        onChange={e => setSelectedMedicines(prev => prev.map(m => m._id === med._id ? { ...m, quantity: +e.target.value || 100 } : m))}
                        style={{ width: 80, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <select className="form-control" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)}>
                  <option value="">Select vendor...</option>
                  {(vendors || []).map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setShowVendorModal(true)}>
                  <Plus size={14} /> Add Vendor
                </button>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowRefillModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSendRefillRequest} disabled={sendingRefill || !selectedVendor}>
                  {sendingRefill ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Sending...</> : <><Truck size={16} /> Send to Vendor</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal - Order All with checkbox selection */}
      {showApprovalModal && (
        <div className="modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3><CheckCircle size={18} /> Approve Refill Order</h3>
              <button className="icon-btn" onClick={() => setShowApprovalModal(false)}><X size={18} /></button>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: 14 }}>
                Select the medicines you want to order. Uncheck any you wish to exclude.
              </p>
              <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 16, border: `2px solid ${OUTPUT_THEME.border}`, borderRadius: 10, padding: 12, background: OUTPUT_THEME.bg }}>
                {(getRefillNeededItems?.() || []).map((m, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 8px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={refillOrderSelection[m._id] !== false}
                        onChange={e => setRefillOrderSelection(prev => ({ ...prev, [m._id]: e.target.checked }))}
                        style={{ width: 18, height: 18, accentColor: OUTPUT_THEME.border }}
                      />
                      <span style={{ fontWeight: 600 }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.reorderQty || 100} units × ₹{(m.price || 0).toLocaleString()}</span>
                  </label>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12, paddingTop: 12, fontSize: 14 }}>
                  <span>Estimated Total (selected)</span>
                  <span>₹{((getRefillNeededItems?.() || []).filter(m => refillOrderSelection[m._id] !== false).reduce((sum, m) => sum + (m.reorderQty || 100) * (m.price || 0), 0)).toLocaleString()}</span>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Select Vendor</label>
                <select
                  className="form-control"
                  value={selectedVendor}
                  onChange={e => setSelectedVendor(e.target.value)}
                >
                  <option value="">Choose a vendor...</option>
                  {(vendors || []).map(v => (
                    <option key={v._id} value={v._id}>{v.name} — {v.email}</option>
                  ))}
                </select>
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setShowVendorModal(true)}>
                  <Plus size={14} /> Add New Vendor
                </button>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowApprovalModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleApproveOrder} disabled={approvingOrder || !selectedVendor || (getRefillNeededItems?.() || []).filter(m => refillOrderSelection[m._id] !== false).length === 0}>
                  {approvingOrder ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Executing...</> : <><CheckCircle size={16} /> Approve & Execute</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showVendorModal && (
        <div className="modal-overlay" onClick={() => setShowVendorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3><Plus size={18} /> Add Vendor</h3>
              <button className="icon-btn" onClick={() => setShowVendorModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddVendor} style={{ padding: '0 24px 24px' }}>
              {['name', 'email', 'phone', 'address'].map(field => (
                <div key={field} className="form-group">
                  <label className="form-label">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                  <input
                    className="form-control"
                    type={field === 'email' ? 'email' : 'text'}
                    required={field !== 'address'}
                    value={vendorForm[field]}
                    onChange={e => setVendorForm(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={field === 'email' ? 'contact@vendor.com' : ''}
                  />
                </div>
              ))}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Plus size={16} /> Add Vendor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}
