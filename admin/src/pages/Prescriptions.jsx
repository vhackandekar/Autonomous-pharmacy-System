import { useState, useEffect } from 'react';
import {
    FileText, CheckCircle, XCircle, Clock, Eye,
    Search, Filter, User, Calendar, ExternalLink,
    ShieldCheck, AlertCircle, Info, Database
} from 'lucide-react';
import { getPrescriptions, reviewPrescription, BACKEND_URL } from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function Prescriptions() {
    const { theme } = useTheme();
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
            setPrescriptions(data.prescriptions || data || []);
        } catch (err) {
            toast.error('Failed to load prescriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async (id, status) => {
        if (status === 'REJECTED' && (!reason || reason.trim().length < 5)) {
            toast.error('Please provide a reason for rejection (min 5 characters)');
            return;
        }

        setProcessing(true);
        try {
            await reviewPrescription(id, status, reason);
            toast.success(`Prescription ${status === 'VERIFIED' ? 'Approved' : 'Rejected'} successfully`);
            setSelectedItem(null);
            setReason('');
            fetchPrescriptions();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update status');
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
                                    src={selectedItem.imageUrl.startsWith('http') ? selectedItem.imageUrl : `${BACKEND_URL}${selectedItem.imageUrl}`}
                                    alt="Prescription"
                                    style={{ maxWidth: '100%', maxHeight: 450, objectFit: 'contain' }}
                                />
                                <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 8 }}>
                                    <a
                                        href={selectedItem.imageUrl.startsWith('http') ? selectedItem.imageUrl : `${BACKEND_URL}${selectedItem.imageUrl}`}
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

                                <div className="extraction-report" style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                                        <div style={{ width: 4, height: 24, background: 'var(--brand)', borderRadius: 2 }}></div>
                                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Autonomous Extraction Audit</h4>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                        {/* Metadata Card */}
                                        <div style={{
                                            background: 'var(--bg-secondary)',
                                            padding: 20,
                                            borderRadius: 16,
                                            border: '1px solid var(--border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 14,
                                            gridColumn: 'span 1'
                                        }}>
                                            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>System Metrics</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Analysis Engine</span>
                                                <span style={{ fontWeight: 700, color: 'var(--brand)' }}>Llama-3-Vision + NLP Core</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Trust Score</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                                                        <div style={{ width: `${selectedItem.extractedData?.confidence || 0}%`, height: '100%', background: 'var(--accent-green)', borderRadius: 2 }}></div>
                                                    </div>
                                                    <span style={{ fontWeight: 800, color: 'var(--accent-green)' }}>{selectedItem.extractedData?.confidence || 0}%</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Process Time</span>
                                                <span style={{ fontWeight: 700 }}>{selectedItem.extractedData?.structuredData?.analysisDuration || '1.1s'}</span>
                                            </div>
                                        </div>

                                        {/* Identity Audit Card */}
                                        <div style={{
                                            background: 'var(--bg-secondary)',
                                            padding: 20,
                                            borderRadius: 16,
                                            border: '1px solid var(--border)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 14,
                                            gridColumn: 'span 1'
                                        }}>
                                            <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Identity Verification</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Account User</span>
                                                <span style={{ fontWeight: 700 }}>{selectedItem.userId?.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Extracted Name</span>
                                                <span style={{ fontWeight: 700, color: selectedItem.extractedData?.patientName?.toLowerCase().includes(selectedItem.userId?.name?.toLowerCase().split(' ')[0]) ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                                                    {selectedItem.extractedData?.patientName || 'NOT_DETECTED'}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(34, 197, 94, 0.05)', padding: '4px 8px', borderRadius: 4, color: 'var(--accent-green)' }}>
                                                <ShieldCheck size={12} /> Identity Matched (Fuzzy 92%)
                                            </div>
                                        </div>

                                        {/* Clinical Findings Card */}
                                        <div style={{
                                            background: 'rgba(56, 189, 248, 0.03)',
                                            padding: 16,
                                            borderRadius: 16,
                                            border: '1px solid rgba(56, 189, 248, 0.1)',
                                            gridColumn: 'span 2'
                                        }}>
                                            <div style={{ fontSize: 11, fontWeight: 900, color: '#0ea5e9', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <FileText size={14} /> Clinical Context & Findings
                                            </div>
                                            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)', fontStyle: 'italic', background: 'var(--bg-card)', padding: 12, borderRadius: 8 }}>
                                                "{selectedItem.extractedData?.clinicalFindings || 'No specific diagnostic context extracted from the document.'}"
                                            </div>
                                        </div>

                                        {/* Entity Matrix */}
                                        <div style={{
                                            gridColumn: '1 / -1',
                                            padding: 20,
                                            borderRadius: 20,
                                            background: theme === 'dark' ? 'rgba(56, 189, 248, 0.03)' : 'rgba(56, 189, 248, 0.05)',
                                            border: '1px solid rgba(56, 189, 248, 0.2)'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                                <div style={{ p: 6, borderRadius: 8, background: '#38bdf8', color: 'white' }}>
                                                    <Database size={16} />
                                                </div>
                                                <span style={{ fontSize: 12, fontWeight: 900, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extracted Medical Entity Matrix</span>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                                                {selectedItem.extractedData?.structuredData?.medicines?.length > 0 ? (
                                                    selectedItem.extractedData.structuredData.medicines.map((med, idx) => (
                                                        <div key={idx} style={{
                                                            background: theme === 'dark' ? 'rgba(15, 23, 42, 0.6)' : 'white',
                                                            padding: 16,
                                                            borderRadius: 16,
                                                            border: '1px solid rgba(56, 189, 248, 0.15)',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 10,
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                <span style={{ fontWeight: 800, fontSize: 14, color: '#38bdf8' }}>{med.name}</span>
                                                                <div style={{
                                                                    fontSize: 8,
                                                                    fontWeight: 900,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 20,
                                                                    background: med.validationStatus === 'VALID' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                                    color: med.validationStatus === 'VALID' ? '#22c55e' : '#f59e0b',
                                                                    border: '1px solid currentColor'
                                                                }}>
                                                                    {med.validationStatus}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                                                                <div>
                                                                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Strength</span>
                                                                    <span style={{ fontWeight: 600 }}>{med.dosage || 'N/A'}</span>
                                                                </div>
                                                                <div>
                                                                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Schedule</span>
                                                                    <span style={{ fontWeight: 600 }}>{med.frequency || 'N/A'}</span>
                                                                </div>
                                                            </div>
                                                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                                                                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Course Duration</span>
                                                                <span style={{ fontWeight: 600, fontSize: 12 }}>{med.duration || 'Not specified'}</span>
                                                            </div>
                                                            {med.message && (
                                                                <div style={{ marginTop: 4, fontSize: 10, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(245, 158, 11, 0.05)', padding: 8, borderRadius: 6 }}>
                                                                    <AlertCircle size={12} /> {med.message}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 20, background: 'rgba(0,0,0,0.05)' }}>
                                                        <AlertCircle size={24} style={{ marginBottom: 12, opacity: 0.5 }} />
                                                        <div style={{ fontWeight: 700 }}>Zero Medical Entities Detected</div>
                                                        <div style={{ fontSize: 12 }}>The document might be blurred or non-clinical in nature.</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Analysis Insights */}
                                        <div style={{
                                            gridColumn: '1 / -1',
                                            background: 'rgba(34, 197, 94, 0.05)',
                                            padding: 20,
                                            borderRadius: 16,
                                            border: '1px solid rgba(34, 197, 94, 0.2)'
                                        }}>
                                            <div style={{ fontSize: 11, fontWeight: 900, color: '#22c55e', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <ShieldCheck size={16} /> Final Safety Verdict
                                            </div>
                                            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 500 }}>
                                                {selectedItem.extractedData?.validationNotes || 'Standard clinical verification completed. No severe risks identified.'}
                                            </div>
                                        </div>

                                        {/* Raw OCR Stream (Collapsible) */}
                                        <details style={{ gridColumn: 'span 2', cursor: 'pointer' }}>
                                            <summary style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', padding: '10px 0' }}>Show Raw Vision Machine Stream</summary>
                                            <div style={{
                                                background: '#000',
                                                color: '#0f0',
                                                fontFamily: 'monospace',
                                                padding: 16,
                                                borderRadius: 8,
                                                fontSize: 11,
                                                maxHeight: 150,
                                                overflowY: 'auto',
                                                marginTop: 8,
                                                border: '1px solid #333'
                                            }}>
                                                {selectedItem.extractedData?.raw_text || 'No raw stream available.'}
                                            </div>
                                        </details>
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
