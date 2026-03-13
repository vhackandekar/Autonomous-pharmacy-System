import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, FileText, CheckCircle2, AlertCircle,
    Loader2, Sparkles, Clock, History, Search,
    Eye, Calendar, ArrowRight, ShieldCheck, Trash2,
    FileSearch, AlertTriangle, RefreshCw, X, ClipboardList
} from 'lucide-react';
import { Card, Button, Badge, Toast } from '../Component/UI';
import { medicineAPI, prescriptionAPI, stockAlertAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const PrescriptionsPage = () => {
    const { user } = useAuth();
    const { theme } = useTheme();

    const [prescriptions, setPrescriptions] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [selectedMedicine, setSelectedMedicine] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingInsights, setViewingInsights] = useState(null);
    const [issuedBy, setIssuedBy] = useState('');
    const [validTill, setValidTill] = useState('');

    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('');
    const [toastType, setToastType] = useState('success');

    const fetchPrescriptions = async () => {
        try {
            const { data } = await prescriptionAPI.getMy();
            setPrescriptions(data);
        } catch (err) {
            console.error("Failed to fetch prescriptions:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMedicines = async () => {
        try {
            const { data } = await medicineAPI.getAll();
            setMedicines(data);
        } catch (err) {
            console.error("Failed to fetch medicines:", err);
        }
    };

    useEffect(() => {
        fetchPrescriptions();
        fetchMedicines();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();

        if (!selectedMedicine || !file || !issuedBy || !validTill) {
            setToastMsg("Please fill all fields and attach a file.");
            setToastType('error');
            setShowToast(true);
            return;
        }

        // Issued By check
        if (issuedBy.trim().length < 3) {
            setToastMsg("Issued By must be at least 3 characters.");
            setToastType('error');
            setShowToast(true);
            return;
        }

        // Date check
        const pickedDate = new Date(validTill);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (pickedDate <= today) {
            setToastMsg("Validity must be a future date.");
            setToastType('error');
            setShowToast(true);
            return;
        }

        // File type check
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setToastMsg("Invalid file type. (JPG, PNG, WEBP or PDF only)");
            setToastType('error');
            setShowToast(true);
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('medicineId', selectedMedicine._id);
        formData.append('issuedBy', issuedBy);
        formData.append('validTill', validTill);
        formData.append('prescription', file);

        try {
            await prescriptionAPI.upload(formData);
            setToastMsg("Upload successful. Clinical verification started.");
            setToastType('success');
            setShowToast(true);
            setFile(null);
            setSelectedMedicine(null);
            setSearchTerm('');
            setIssuedBy('');
            setValidTill('');
            fetchPrescriptions();
        } catch (err) {
            setToastMsg(err.response?.data?.error || "Upload failed");
            setToastType('error');
            setShowToast(true);
        } finally {
            setIsUploading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'VERIFIED': return <Badge variant="success">Verified</Badge>;
            case 'REJECTED': return <Badge variant="error">Rejected</Badge>;
            case 'PENDING_ADMIN_REVIEW': return <Badge variant="warning">Reviewing</Badge>;
            case 'UPLOADED': return <Badge variant="info">Scanning...</Badge>;
            default: return <Badge variant="info">Processing</Badge>;
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Remove this prescription record?")) return;
        try {
            await prescriptionAPI.delete(id);
            setToastMsg("Record removed");
            setToastType('success');
            setShowToast(true);
            fetchPrescriptions();
        } catch (err) {
            setToastMsg(err.response?.data?.error || "Delete failed");
            setToastType('error');
            setShowToast(true);
        }
    };

    return (
        <>
            <div className="p-8 max-w-6xl mx-auto space-y-10">
                {/* Minimal Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-brand-text-primary">Clinical Verification</h2>
                        <p className="text-sm font-medium opacity-40 text-brand-text-secondary uppercase tracking-widest mt-1">AI-Powered Prescription Portal</p>
                    </div>
                    <button
                        onClick={fetchPrescriptions}
                        className="p-3 bg-brand-card border border-brand-border-color rounded-xl text-brand-text-secondary hover:text-brand-primary transition-all active:scale-95 shadow-sm"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {/* NEW UPLOAD SECTION */}
                <Card className="p-8 border-brand-primary/20 bg-brand-primary/5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-brand-primary text-white rounded-lg">
                            <Upload size={18} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg">Upload New Prescription</h3>
                            <p className="text-[10px] uppercase font-bold opacity-40">AI-Assisted Processing</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        {/* Medicine Search/Select */}
                        <div className="space-y-1.5 relative">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Relates to Medicine</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setIsDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    placeholder="Search medicine..."
                                    className="w-full bg-brand-card border border-brand-border-color rounded-xl px-4 py-3 text-sm focus:border-brand-primary transition-all pr-10"
                                />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20" size={16} />

                                {isDropdownOpen && searchTerm && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-brand-card border border-brand-border-color rounded-xl shadow-2xl z-[100] max-h-48 overflow-y-auto overflow-x-hidden">
                                        {medicines
                                            .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map(m => (
                                                <button
                                                    key={m._id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedMedicine(m);
                                                        setSearchTerm(m.name);
                                                        setIsDropdownOpen(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-bold hover:bg-brand-primary hover:text-white transition-colors flex items-center justify-between"
                                                >
                                                    <span>{m.name}</span>
                                                    <Badge variant="secondary" className="text-[8px]">{m.dosage}</Badge>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Issued By */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Issued By (Doctor)</label>
                            <input
                                type="text"
                                value={issuedBy}
                                onChange={(e) => setIssuedBy(e.target.value)}
                                placeholder="Dr. Name / Clinic"
                                className="w-full bg-brand-card border border-brand-border-color rounded-xl px-4 py-3 text-sm focus:border-brand-primary transition-all"
                            />
                        </div>

                        {/* Valid Till */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">Valid Until</label>
                            <input
                                type="date"
                                value={validTill}
                                onChange={(e) => setValidTill(e.target.value)}
                                className="w-full bg-brand-card border border-brand-border-color rounded-xl px-4 py-3 text-sm focus:border-brand-primary transition-all [color-scheme:dark]"
                            />
                        </div>

                        {/* File & Submit */}
                        <div className="flex items-center gap-2">
                            <label className="flex-1 relative cursor-pointer group">
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    accept="image/*,.pdf"
                                />
                                <div className={`flex items-center justify-center space-x-2 py-3 border-2 border-dashed rounded-xl transition-all ${file ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-brand-border-color opacity-30 group-hover:opacity-100 group-hover:border-brand-primary'}`}>
                                    <ClipboardList size={16} />
                                    <span className="text-[10px] font-black uppercase truncate max-w-[100px]">{file ? file.name : 'Attach'}</span>
                                </div>
                            </label>
                            <button
                                type="submit"
                                disabled={isUploading}
                                className="bg-brand-primary hover:bg-brand-secondary text-white p-3 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isUploading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
                            </button>
                        </div>
                    </form>
                </Card>

                <div className="space-y-6">
                    <div className="flex items-center space-x-2 px-2">
                        <History size={16} className="text-brand-primary" />
                        <h3 className="font-black text-sm uppercase tracking-widest opacity-40">Verification History</h3>
                    </div>
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <Loader2 className="animate-spin text-brand-primary opacity-20" size={32} />
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-20 italic">Synchronizing clinical data...</p>
                        </div>
                    ) : prescriptions.length === 0 ? (
                        <Card className="flex flex-col items-center justify-center py-24 text-center border-dashed bg-brand-hover-tint/10">
                            <div className="w-16 h-16 bg-brand-hover-tint rounded-2xl flex items-center justify-center mb-4 opacity-30">
                                <FileSearch size={32} />
                            </div>
                            <h4 className="font-bold text-lg mb-1 opacity-60">No Clinical Records Found</h4>
                            <p className="text-sm opacity-30 max-w-xs mx-auto">Upload your document above to begin autonomous safety verification.</p>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <AnimatePresence mode="popLayout">
                                {prescriptions.map((presc) => (
                                    <motion.div
                                        key={presc._id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        layout
                                    >
                                        <Card className="p-5 flex items-center gap-6 relative overflow-hidden group hover:border-brand-primary/30 transition-all duration-300 shadow-sm hover:shadow-xl">
                                            {/* Media Preview */}
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-brand-background flex-shrink-0 border border-brand-border-color p-1">
                                                <img
                                                    src={presc.imageUrl.startsWith('http') ? presc.imageUrl : `http://localhost:5000${presc.imageUrl}`}
                                                    className="w-full h-full object-cover rounded-xl opacity-80 group-hover:opacity-100 transition-opacity"
                                                />
                                            </div>

                                            {/* Identity & Status */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex flex-col">
                                                        <h4 className="font-black text-base truncate flex items-center">
                                                            {presc.medicineId?.name || 'Medication'}
                                                            {presc.status === 'VERIFIED' && <CheckCircle2 size={14} className="ml-2 text-emerald-500" />}
                                                        </h4>
                                                        <span className="text-[10px] font-bold opacity-30 uppercase flex items-center mt-0.5">
                                                            Uploaded {new Date(presc.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    {getStatusBadge(presc.status)}
                                                </div>

                                                {/* LIVE ANALYTICS SUITE */}
                                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.confidence > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30'}`}>
                                                        <Sparkles size={10} /> <span>Extraction</span>
                                                    </div>
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.detectedMedicines?.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30'}`}>
                                                        <Search size={10} /> <span>Match</span>
                                                    </div>
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.validationNotes?.includes('out of stock') ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : (presc.extractedData?.confidence > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30')}`}>
                                                        <CheckCircle2 size={10} /> <span>Stock Check</span>
                                                    </div>
                                                    <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter border transition-all ${presc.extractedData?.validationNotes?.includes('OTC') ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : (presc.extractedData?.confidence > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-brand-hover-tint border-brand-border-color opacity-30')}`}>
                                                        <ShieldCheck size={10} /> <span>Tag Verify</span>
                                                    </div>
                                                </div>

                                                {/* CLINICAL NOTES */}
                                                {presc.extractedData?.validationNotes && presc.status !== 'VERIFIED' && (
                                                    <p className="text-[9px] font-bold text-amber-500 mt-3 italic leading-tight flex items-center bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                                        <AlertTriangle size={12} className="mr-2 flex-shrink-0" />
                                                        {presc.extractedData.validationNotes}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => setViewingInsights(viewingInsights === presc._id ? null : presc._id)}
                                                    className={`p-3 rounded-xl transition-all ${viewingInsights === presc._id ? 'bg-brand-primary text-white' : 'bg-brand-hover-tint text-brand-text-secondary hover:text-brand-primary hover:bg-brand-primary/10'}`}
                                                    type="button"
                                                    title="View Extraction Insights"
                                                >
                                                    <FileSearch size={16} />
                                                </button>
                                                <a
                                                    href={presc.imageUrl.startsWith('http') ? presc.imageUrl : `http://localhost:5000${presc.imageUrl}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-3 bg-brand-hover-tint text-brand-text-secondary rounded-xl hover:text-brand-primary transition-all hover:bg-brand-primary/10"
                                                    title="View Original"
                                                >
                                                    <Eye size={16} />
                                                </a>
                                                <button
                                                    onClick={() => handleDelete(presc._id)}
                                                    className="p-3 bg-brand-hover-tint text-rose-500 rounded-xl hover:bg-rose-500/10 transition-all"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* OCR Insights Overlay/Drawer */}
                                            {viewingInsights === presc._id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    className="absolute inset-x-0 bottom-0 bg-brand-card border-t border-brand-border-color p-4 z-10"
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h5 className="text-[10px] font-black uppercase tracking-widest opacity-60">Autonomous Extraction Insights</h5>
                                                        <button onClick={() => setViewingInsights(null)} className="text-rose-500 hover:bg-rose-500/10 p-1 rounded-lg">
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                    <div className="bg-brand-background rounded-xl p-3 border border-brand-border-color overflow-hidden">
                                                        <pre className="text-[10px] font-mono text-emerald-500 overflow-x-auto">
                                                            {JSON.stringify({
                                                                engine: "Tesseract.js OCR",
                                                                confidence: presc.extractedData?.confidence,
                                                                medicines: presc.extractedData?.detectedMedicines,
                                                                dosage: presc.extractedData?.dosage,
                                                                doctor: presc.extractedData?.doctorName,
                                                                timestamp: presc.createdAt
                                                            }, null, 2)}
                                                        </pre>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </Card>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>

            <Toast
                message={toastMsg}
                visible={showToast}
                type={toastType}
                onClose={() => setShowToast(false)}
            />
        </>
    );
};

export default PrescriptionsPage;
