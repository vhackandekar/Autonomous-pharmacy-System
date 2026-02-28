import { useState, useEffect } from 'react';
import {
    FileText, CheckCircle, XCircle, Clock, Eye,
    Search, Filter, User, Calendar, ExternalLink,
    ShieldCheck, AlertCircle, Info
} from 'lucide-react';
import { getPrescriptions, reviewPrescription } from '../utils/api';
import toast from 'react-hot-toast';

export default function Prescriptions() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('PENDING_ADMIN_REVIEW');
    const [search, setSearch] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const fetchPrescriptions = async () => {
        try {
            const { data } = await getPrescriptions();
            setPrescriptions(data);
        } catch (err) {
            toast.error('Failed to load prescriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (id, status) => {
        setProcessing(true);
        try {
            await reviewPrescription(id, status, reason);
            toast.success(`Prescription ${status.toLowerCase()} successfully`);
            setSelectedItem(null);
            setReason('');
            fetchPrescriptions();
        } catch (err) {
            toast.error('Failed to update status');
        } finally {
            setProcessing(false);
        }
    };

    const filteredData = prescriptions.filter(p => {
        const matchesFilter = filter === 'ALL' || p.status === filter;
        const matchesSearch =
            p.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.medicineId?.name?.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusStyle = (status) => {
        switch (status) {
            case 'VERIFIED': return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', icon: CheckCircle };
            case 'REJECTED': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: XCircle };
            case 'PENDING_ADMIN_REVIEW': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: Clock };
            case 'UPLOADED': return { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', icon: Clock };
            case 'EXPIRED': return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', icon: AlertCircle };
            default: return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', icon: Info };
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1>Prescription Management</h1>
                    <p>Verify and manage patient prescriptions with AI assistance</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search patient or medicine..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
                {[
                    { label: 'Reviewing', value: 'PENDING_ADMIN_REVIEW' },
                    { label: 'Verified', value: 'VERIFIED' },
                    { label: 'Rejected', value: 'REJECTED' },
                    { label: 'All', value: 'ALL' }
                ].map(f => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`btn ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '8px 16px', fontSize: 13 }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Patient</th>
                            <th>Medicine</th>
                            <th>AI Confidence</th>
                            <th>Uploaded</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i}><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
                            ))
                        ) : filteredData.length === 0 ? (
                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No prescriptions found</td></tr>
                        ) : filteredData.map((item) => {
                            const style = getStatusStyle(item.status);
                            const StatusIcon = style.icon;
                            return (
                                <tr key={item._id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                                                {item.userId?.name?.[0] || 'U'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{item.userId?.name || 'Unknown'}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.userId?.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{item.medicineId?.name}</div>
                                    </td>
                                    <td>
                                        {item.extractedData?.confidence ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${item.extractedData.confidence}%`,
                                                        background: item.extractedData.confidence > 75 ? 'var(--brand)' : '#f59e0b'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 700 }}>
                                                    {item.extractedData.confidence}%
                                                </span>
                                            </div>
                                        ) : 'N/A'}
                                    </td>
                                    <td style={{ fontSize: 13 }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <span className="status-badge" style={{ background: style.bg, color: style.color, border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            <StatusIcon size={12} /> {item.status}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: 6 }}
                                            onClick={() => setSelectedItem(item)}
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modern Silent Modal */}
            {selectedItem && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: 24
                }}>
                    <div className="card animate-scale-in" style={{
                        maxWidth: 1000, width: '100%', maxHeight: '90vh', overflow: 'hidden',
                        display: 'grid', gridTemplateColumns: '1fr 380px', padding: 0
                    }}>
                        {/* Image Side */}
                        <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                            <img
                                src={`http://localhost:5000${selectedItem.imageUrl}`}
                                alt="Prescription"
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                            <a
                                href={`http://localhost:5000${selectedItem.imageUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', color: 'white', padding: 8, borderRadius: 8 }}
                            >
                                <ExternalLink size={18} />
                            </a>
                        </div>

                        {/* Analysis Side */}
                        <div style={{ padding: 32, display: 'flex', flexCol: 'column', gap: 24, overflowY: 'auto', borderLeft: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0 }}>Review Details</h3>
                                <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <ShieldCheck size={20} color="var(--brand)" />
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>Clinical Validation Notes</span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                                    {selectedItem.extractedData?.validationNotes || "System automatically flagged this for review."}
                                </p>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                                    <div style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: selectedItem.extractedData?.confidence > 0 ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)', color: selectedItem.extractedData?.confidence > 0 ? '#22c55e' : 'var(--text-muted)', border: '1px solid currentColor' }}>Extraction</div>
                                    <div style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: selectedItem.extractedData?.detectedMedicines?.length > 0 ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)', color: selectedItem.extractedData?.detectedMedicines?.length > 0 ? '#22c55e' : 'var(--text-muted)', border: '1px solid currentColor' }}>Match</div>
                                    <div style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: selectedItem.extractedData?.validationNotes?.includes('out of stock') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: selectedItem.extractedData?.validationNotes?.includes('out of stock') ? '#ef4444' : '#22c55e', border: '1px solid currentColor' }}>Stock</div>
                                    <div style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: selectedItem.extractedData?.validationNotes?.includes('OTC') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: selectedItem.extractedData?.validationNotes?.includes('OTC') ? '#f59e0b' : '#22c55e', border: '1px solid currentColor' }}>Tag Check</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient</label>
                                    <div style={{ fontWeight: 600 }}>{selectedItem.userId?.name}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Medicine</label>
                                    <div style={{ fontWeight: 600 }}>{selectedItem.medicineId?.name}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doctor</label>
                                    <div style={{ fontWeight: 600 }}>{selectedItem.extractedData?.doctorName || selectedItem.issuedBy}</div>
                                </div>
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expiry</label>
                                    <div style={{ fontWeight: 600 }}>{new Date(selectedItem.validTill).toLocaleDateString()}</div>
                                </div>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dosage (Extracted)</label>
                                    <div style={{ fontWeight: 600, color: 'var(--brand)' }}>{selectedItem.extractedData?.dosage || "Not identified"}</div>
                                </div>
                                {selectedItem.extractedData?.ocrRawText && (
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Raw Scanned Text</label>
                                        <div style={{
                                            fontSize: 10,
                                            color: 'var(--text-secondary)',
                                            background: 'var(--bg-tertiary)',
                                            padding: 8,
                                            borderRadius: 8,
                                            maxHeight: 60,
                                            overflowY: 'auto',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {selectedItem.extractedData.ocrRawText}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group" style={{ marginTop: 'auto' }}>
                                <label className="form-label">Pharmacist Note (Optional)</label>
                                <textarea
                                    className="form-control"
                                    rows="3"
                                    placeholder="Reason for rejection or approval notes..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <button
                                    className="btn"
                                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                    onClick={() => handleReview(selectedItem._id, 'REJECTED')}
                                    disabled={processing}
                                >
                                    <XCircle size={18} /> Reject
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => handleReview(selectedItem._id, 'VERIFIED')}
                                    disabled={processing}
                                >
                                    <CheckCircle size={18} /> Approve
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        
        .search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 8px 16px;
          border-radius: 12px;
          min-width: 300px;
        }
        .search-box input {
          background: none;
          border: none;
          outline: none;
          color: var(--text-primary);
          width: 100%;
          font-size: 14px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        .data-table th {
          text-align: left;
          padding: 16px 24px;
          font-size: 12px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }
        .data-table td {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
        }
        .status-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
      `}</style>
        </div>
    );
}
