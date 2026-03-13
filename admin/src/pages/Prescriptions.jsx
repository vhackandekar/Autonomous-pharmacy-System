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
        let matchesFilter = filter === 'ALL' || p.status === filter;
        if (filter === 'PENDING_ADMIN_REVIEW') {
            matchesFilter = ['PENDING_ADMIN_REVIEW', 'WARNING', 'DANGEROUS', 'OCR_PARSED'].includes(p.status);
        }

        const matchesSearch =
            p.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            p.medicineId?.name?.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusStyle = (status) => {
        switch (status) {
            case 'VERIFIED': return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', icon: CheckCircle };
            case 'REJECTED': return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: XCircle };
            case 'DANGEROUS': return { bg: 'rgba(153, 27, 27, 0.2)', color: '#ef4444', icon: AlertCircle };
            case 'WARNING': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: AlertCircle };
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
                        maxWidth: 700, width: '100%', maxHeight: '95vh', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', padding: 0,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        {/* Header Section */}
                        <div style={{
                            padding: '16px 24px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--bg-card)'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Review Prescription</h3>
                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>Verify extracted data against the image</p>
                            </div>
                            <button onClick={() => setSelectedItem(null)} style={{ background: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 8, borderRadius: '50%', display: 'flex' }}>
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* Image Side - Now on Top */}
                            <div style={{
                                background: '#0a0a0a',
                                minHeight: 450,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <img
                                    src={selectedItem.imageUrl.startsWith('http') ? selectedItem.imageUrl : `http://localhost:5000${selectedItem.imageUrl}`}
                                    alt="Prescription"
                                    style={{ maxWidth: '100%', maxHeight: 450, objectFit: 'contain' }}
                                />
                                <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 8 }}>
                                    <a
                                        href={selectedItem.imageUrl.startsWith('http') ? selectedItem.imageUrl : `http://localhost:5000${selectedItem.imageUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-secondary"
                                        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <ExternalLink size={14} /> Full Screen
                                    </a>
                                </div>
                            </div>

                            {/* Analysis Side - Now below */}
                            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <div style={{
                                    background: selectedItem.status === 'DANGEROUS' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)',
                                    padding: 20,
                                    borderRadius: 16,
                                    border: `1px solid ${selectedItem.status === 'DANGEROUS' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.1)'}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                        <div style={{ background: selectedItem.status === 'DANGEROUS' ? '#ef4444' : 'var(--brand)', color: 'white', padding: 6, borderRadius: 8 }}>
                                            {selectedItem.status === 'DANGEROUS' ? <AlertCircle size={18} /> : <ShieldCheck size={18} />}
                                        </div>
                                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                                            {selectedItem.status === 'DANGEROUS' ? '⚠️ CRITICAL SAFETY ALERT' : 'Clinical Validation Notes'}
                                        </span>
                                    </div>
                                    <p style={{
                                        fontSize: 13,
                                        color: selectedItem.status === 'DANGEROUS' ? '#ef4444' : 'var(--text-secondary)',
                                        lineHeight: 1.6,
                                        margin: 0,
                                        fontWeight: selectedItem.status === 'DANGEROUS' ? 700 : 400,
                                        background: 'var(--bg-card)',
                                        padding: 12,
                                        borderRadius: 8,
                                        border: selectedItem.status === 'DANGEROUS' ? '1px solid #ef4444' : 'none'
                                    }}>
                                        {selectedItem.extractedData?.validationNotes || "System automatically flagged this for review."}
                                    </p>

                                    {/* Detailed Warnings from AI Engine */}
                                    {selectedItem.extractedData?.structuredData?.warnings?.length > 0 && (
                                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {selectedItem.extractedData.structuredData.warnings.map((w, idx) => (
                                                <div key={idx} style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                                                    <AlertCircle size={14} /> {w}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                                        {[
                                            { label: 'Extraction', active: selectedItem.extractedData?.confidence > 0, color: '#22c55e' },
                                            { label: 'Match', active: selectedItem.extractedData?.detectedMedicines?.length > 0, color: '#22c55e' },
                                            { label: 'Stock', active: !selectedItem.extractedData?.validationNotes?.includes('out of stock'), color: '#22c55e', fallbackColor: '#ef4444' },
                                            { label: 'Safety', active: selectedItem.status !== 'DANGEROUS', color: '#22c55e', fallbackColor: '#ef4444' },
                                            { label: 'Dosage', active: !selectedItem.extractedData?.validationNotes?.includes('Dosage'), color: '#22c55e', fallbackColor: '#f59e0b' }
                                        ].map((tag, idx) => (
                                            <div key={idx} style={{
                                                padding: '6px 12px',
                                                borderRadius: 8,
                                                fontSize: 10,
                                                fontWeight: 800,
                                                textTransform: 'uppercase',
                                                background: tag.active ? `rgba(34, 197, 94, 0.1)` : (tag.fallbackColor === '#ef4444' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'),
                                                color: tag.active ? tag.color : (tag.fallbackColor || 'var(--text-muted)'),
                                                border: '1px solid currentColor'
                                            }}>
                                                {tag.label}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24 }}>
                                    <div className="info-item">
                                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>Patient Name</label>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{selectedItem.userId?.name}</div>
                                    </div>
                                    <div className="info-item">
                                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>Medicine Prescribed</label>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{selectedItem.medicineId?.name}</div>
                                    </div>
                                    <div className="info-item">
                                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>Prescribing doctor</label>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-blue)' }}>{selectedItem.extractedData?.doctorName || selectedItem.issuedBy || "Not detected"}</div>
                                    </div>
                                    <div className="info-item">
                                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>Valid Until</label>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{new Date(selectedItem.validTill).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1', background: 'var(--bg-secondary)', padding: '16px 20px', borderRadius: 12, borderLeft: '4px solid var(--brand)' }}>
                                        <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block', letterSpacing: '0.05em' }}>Extracted Dosage & Instructions</label>
                                        <div style={{ fontWeight: 800, color: 'var(--brand)', fontSize: 18, lineHeight: 1.4 }}>{selectedItem.extractedData?.dosage || "Manual verification required"}</div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <FileText size={16} /> Raw Extraction Data (JSON)
                                    </label>
                                    <div style={{
                                        background: '#0a0a0a',
                                        borderRadius: 12,
                                        padding: 16,
                                        fontSize: 11,
                                        fontFamily: 'monospace',
                                        color: '#22c55e',
                                        overflow: 'auto',
                                        maxHeight: 200,
                                        border: '1px solid var(--border)',
                                        marginTop: 8
                                    }}>
                                        <pre style={{ margin: 0 }}>
                                            {JSON.stringify({
                                                technique: "Tesseract.js OCR + Fuzzy Matching Engine",
                                                ...selectedItem.extractedData
                                            }, null, 2)}
                                        </pre>
                                    </div>
                                </div>

                                {/* Only show review controls if not already processed */}
                                {selectedItem.status !== 'VERIFIED' && selectedItem.status !== 'REJECTED' && (
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: 13, fontWeight: 600 }}>Pharmacist Review Notes</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder="Add any specific instructions or reason for rejection here..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            style={{ resize: 'none', background: 'var(--bg-card)', borderRadius: 12, padding: 12 }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions (Only show if not yet processed) */}
                        {selectedItem.status !== 'VERIFIED' && selectedItem.status !== 'REJECTED' && (
                            <div style={{
                                padding: 20,
                                display: 'grid',
                                gridTemplateColumns: '1fr 1.5fr',
                                gap: 16,
                                background: 'var(--bg-card)',
                                borderTop: '1px solid var(--border)'
                            }}>
                                <button
                                    className="btn"
                                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', height: 48, borderRadius: 12, fontWeight: 700 }}
                                    onClick={() => handleReview(selectedItem._id, 'REJECTED')}
                                    disabled={processing}
                                >
                                    <XCircle size={18} /> Reject Prescription
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ height: 48, borderRadius: 12, fontWeight: 700, boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)' }}
                                    onClick={() => handleReview(selectedItem._id, 'VERIFIED')}
                                    disabled={processing}
                                >
                                    <CheckCircle size={18} /> Approve & Verify
                                </button>
                            </div>
                        )}
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
